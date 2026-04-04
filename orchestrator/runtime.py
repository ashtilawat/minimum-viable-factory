"""Runtime adapter for Claude SDK and Codex CLI backends."""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import tempfile
import threading
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

from orchestrator.config import (
    AGENT_CONTEXT_FILE,
    AGENT_RUNTIME,
    CODEX_BIN,
    CODEX_MODEL,
    CODEX_STREAM_OUTPUT,
    CURSOR_BIN,
    CURSOR_MODEL,
    CURSOR_STREAM_OUTPUT,
    REPO_ROOT,
    logger,
)

RuntimeProfileName = Literal["general", "infra", "git_only", "pr"]

_ENV_PLACEHOLDER = re.compile(r"^\$\{([^}]+)\}$")
_CLAUDE_SETTINGS_PATH = REPO_ROOT / ".claude" / "settings.json"

# Serialize writes to <workspace>/.cursor/mcp.json when multiple agents share a cwd.
_cursor_workspace_mcp_locks: dict[str, asyncio.Lock] = {}
_cursor_mcp_lock_init = threading.Lock()


def _workspace_mcp_lock(cwd: str) -> asyncio.Lock:
    key = str(Path(cwd).resolve())
    with _cursor_mcp_lock_init:
        if key not in _cursor_workspace_mcp_locks:
            _cursor_workspace_mcp_locks[key] = asyncio.Lock()
    return _cursor_workspace_mcp_locks[key]


@dataclass(frozen=True)
class RuntimeProfile:
    claude_allowed_tools: tuple[str, ...]
    codex_mcp_servers: tuple[str, ...] = ()
    skip_git_repo_check: bool = False


PROFILES: dict[RuntimeProfileName, RuntimeProfile] = {
    "general": RuntimeProfile(
        claude_allowed_tools=(
            "Read", "Write", "Edit", "Bash", "Glob", "Grep",
            "mcp__linear__*", "mcp__github__*",
            "mcp__vercel__*", "mcp__supabase__*", "mcp__slack__*",
        ),
        codex_mcp_servers=("linear", "github", "vercel", "supabase", "slack"),
    ),
    "infra": RuntimeProfile(
        claude_allowed_tools=("Bash", "mcp__github__*", "mcp__vercel__*", "mcp__supabase__*"),
        codex_mcp_servers=("github", "vercel", "supabase"),
        skip_git_repo_check=True,
    ),
    "git_only": RuntimeProfile(
        claude_allowed_tools=("Bash",),
        skip_git_repo_check=False,
    ),
    "pr": RuntimeProfile(
        claude_allowed_tools=("Bash", "Read", "Glob", "mcp__github__*", "mcp__linear__*"),
        codex_mcp_servers=("github", "linear"),
    ),
}


async def run_runtime_prompt(
    prompt: str,
    cwd: str,
    profile: RuntimeProfileName,
    *,
    fallback_output: str | None = None,
    fallback_warning: str | None = None,
) -> str:
    """Run a prompt through the configured backend and return the final text."""
    runtime_profile = PROFILES[profile]
    runtime_name = AGENT_RUNTIME.lower()

    if runtime_name == "claude":
        return await _run_claude_prompt(prompt, cwd, runtime_profile, fallback_output, fallback_warning)
    if runtime_name == "codex":
        return await _run_codex_prompt(prompt, cwd, runtime_profile)
    if runtime_name == "cursor":
        return await _run_cursor_prompt(prompt, cwd, runtime_profile)
    raise RuntimeError(
        f"Unsupported AGENT_RUNTIME={AGENT_RUNTIME!r}. Expected 'claude', 'codex', or 'cursor'."
    )


async def _run_claude_prompt(
    prompt: str,
    cwd: str,
    profile: RuntimeProfile,
    fallback_output: str | None,
    fallback_warning: str | None,
) -> str:
    try:
        from claude_agent_sdk import query as claude_query, ClaudeAgentOptions
    except ImportError as exc:
        if fallback_warning:
            logger.warning(fallback_warning)
        if fallback_output is not None:
            return fallback_output
        raise RuntimeError("Claude runtime is selected, but claude-agent-sdk is not installed.") from exc

    options = ClaudeAgentOptions(
        cwd=cwd,
        permission_mode="bypassPermissions",
        allowed_tools=list(profile.claude_allowed_tools),
    )
    output_parts: list[str] = []
    async for message in claude_query(prompt=prompt, options=options):
        if hasattr(message, "content"):
            for block in message.content:
                if hasattr(block, "text"):
                    output_parts.append(block.text)
    return "\n".join(output_parts)


async def _drain_subprocess_stream(
    stream: asyncio.StreamReader | None,
    log_prefix: str,
    label: str,
    *,
    stream_output: bool,
) -> bytes:
    if stream is None:
        return b""
    if not stream_output:
        return await stream.read()
    chunks: list[bytes] = []
    while True:
        line = await stream.readline()
        if not line:
            break
        chunks.append(line)
        text = line.decode("utf-8", errors="replace").rstrip("\r\n")
        if text:
            logger.info("[%s:%s] %s", log_prefix, label, text)
    rest = await stream.read()
    if rest:
        chunks.append(rest)
        tail = rest.decode("utf-8", errors="replace").rstrip("\r\n")
        if tail:
            logger.info("[%s:%s] %s", log_prefix, label, tail)
    return b"".join(chunks)


async def _run_codex_prompt(
    prompt: str,
    cwd: str,
    profile: RuntimeProfile,
) -> str:
    codex_path = shutil.which(CODEX_BIN)
    if not codex_path:
        raise RuntimeError(
            f"Codex runtime is selected, but the '{CODEX_BIN}' CLI was not found on PATH."
        )

    env = _build_codex_environment(profile)
    output_file = tempfile.NamedTemporaryFile(prefix="codex-output-", suffix=".txt", delete=False)
    output_file_path = Path(output_file.name)
    output_file.close()

    args = [
        codex_path,
        "exec",
        "--cd",
        cwd,
        "--dangerously-bypass-approvals-and-sandbox",
        "--output-last-message",
        str(output_file_path),
    ]
    if profile.skip_git_repo_check:
        args.append("--skip-git-repo-check")
    if CODEX_MODEL:
        args.extend(["--model", CODEX_MODEL])
    for override in _codex_config_overrides(profile, env):
        args.extend(["-c", override])
    args.append(prompt)

    try:
        process = await asyncio.create_subprocess_exec(
            *args,
            cwd=cwd,
            env=env,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stream_out = CODEX_STREAM_OUTPUT
        stdout_task = asyncio.create_task(
            _drain_subprocess_stream(process.stdout, "codex", "stdout", stream_output=stream_out)
        )
        stderr_task = asyncio.create_task(
            _drain_subprocess_stream(process.stderr, "codex", "stderr", stream_output=stream_out)
        )
        try:
            await asyncio.wait_for(process.wait(), timeout=10)
        except asyncio.TimeoutError:
            await process.wait()
        stdout_bytes = await stdout_task
        stderr_bytes = await stderr_task
        stdout = stdout_bytes.decode("utf-8", errors="replace").strip()
        stderr = stderr_bytes.decode("utf-8", errors="replace").strip()
        output = output_file_path.read_text().strip() if output_file_path.exists() else ""

        if process.returncode != 0:
            details = stderr or stdout or "codex exec exited without output"
            raise RuntimeError(f"codex exec failed ({process.returncode}): {details}")
        return output or stdout
    except FileNotFoundError as exc:
        raise
    finally:
        output_file_path.unlink(missing_ok=True)


def _resolved_mcp_servers_for_profile(profile: RuntimeProfile) -> dict[str, dict]:
    """Build mcpServers map for Cursor's mcp.json with env placeholders resolved to values."""
    servers: dict[str, dict] = {}
    for name in profile.codex_mcp_servers:
        server = _load_claude_mcp_settings().get(name)
        if not server or not server.get("command"):
            continue
        entry: dict = {"command": server["command"]}
        if server.get("args"):
            entry["args"] = list(server["args"])
        env_block: dict[str, str] = {}
        for target, raw_value in server.get("env", {}).items():
            value = _resolve_env_value(raw_value)
            if value:
                env_block[target] = value
        if env_block:
            entry["env"] = env_block
        servers[name] = entry
    return servers


async def _run_cursor_prompt(
    prompt: str,
    cwd: str,
    profile: RuntimeProfile,
) -> str:
    """Run a prompt via Cursor Agent CLI (headless) and return stdout (final printed output).

    Does not override HOME: ``agent login`` on macOS stores credentials in the user keychain,
    which only lines up with the real home directory. MCP definitions from the profile are
    written to ``<workspace>/.cursor/mcp.json`` with backup/restore so parallel runs on the
    same workspace are serialized and the file is not left changed afterward.
    """
    cursor_path = shutil.which(CURSOR_BIN)
    if not cursor_path:
        raise RuntimeError(
            f"Cursor runtime is selected, but the '{CURSOR_BIN}' CLI was not found on PATH."
        )

    base_env = _build_codex_environment(profile)
    servers = _resolved_mcp_servers_for_profile(profile)

    full_prompt = prompt
    if AGENT_CONTEXT_FILE.exists():
        full_prompt = (
            "# Factory context (from CLAUDE.md)\n\n"
            + AGENT_CONTEXT_FILE.read_text(encoding="utf-8")
            + "\n\n---\n\n# Task\n\n"
            + prompt
        )

    args: list[str] = [
        cursor_path,
        "--print",
        "--force",
        "--trust",
        "--approve-mcps",
        "--sandbox",
        "disabled",
        "--workspace",
        cwd,
    ]
    if CURSOR_MODEL:
        args.extend(["--model", CURSOR_MODEL])
    args.append(full_prompt)

    async def _exec_agent(env: dict[str, str]) -> str:
        process = await asyncio.create_subprocess_exec(
            *args,
            cwd=cwd,
            env=env,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stream_out = CURSOR_STREAM_OUTPUT
        stdout_task = asyncio.create_task(
            _drain_subprocess_stream(process.stdout, "cursor", "stdout", stream_output=stream_out)
        )
        stderr_task = asyncio.create_task(
            _drain_subprocess_stream(process.stderr, "cursor", "stderr", stream_output=stream_out)
        )
        await process.wait()
        stdout_bytes = await stdout_task
        stderr_bytes = await stderr_task
        stdout = stdout_bytes.decode("utf-8", errors="replace").strip()
        stderr = stderr_bytes.decode("utf-8", errors="replace").strip()
        if process.returncode != 0:
            details = stderr or stdout or "cursor agent exited without output"
            raise RuntimeError(f"cursor agent failed ({process.returncode}): {details}")
        return stdout

    if not servers:
        return await _exec_agent(dict(base_env))

    ws = Path(cwd).resolve()
    cursor_dir = ws / ".cursor"
    mcp_path = cursor_dir / "mcp.json"
    lock = _workspace_mcp_lock(cwd)
    async with lock:
        had_cursor_dir = cursor_dir.exists()
        backup = mcp_path.read_bytes() if mcp_path.exists() else None
        try:
            cursor_dir.mkdir(parents=True, exist_ok=True)
            mcp_path.write_text(
                json.dumps({"mcpServers": servers}, indent=2),
                encoding="utf-8",
            )
            return await _exec_agent(dict(base_env))
        finally:
            if backup is not None:
                mcp_path.write_bytes(backup)
            else:
                mcp_path.unlink(missing_ok=True)
            if not had_cursor_dir:
                try:
                    cursor_dir.rmdir()
                except OSError:
                    pass


def _codex_config_overrides(profile: RuntimeProfile, env: dict[str, str]) -> list[str]:
    overrides = [
        'shell_environment_policy.inherit="all"',
    ]
    if AGENT_CONTEXT_FILE.exists():
        overrides.append(f"model_instructions_file={json.dumps(str(AGENT_CONTEXT_FILE))}")

    for name in profile.codex_mcp_servers:
        server = _load_claude_mcp_settings().get(name)
        if not server:
            continue

        prefix = f"mcp_servers.{name}"
        command = server.get("command")
        args = server.get("args")
        env_vars = _resolve_server_env(server, env)

        if command:
            overrides.append(f"{prefix}.command={json.dumps(command)}")
        if args:
            overrides.append(f"{prefix}.args={json.dumps(args)}")
        if env_vars:
            overrides.append(f"{prefix}.env_vars={json.dumps(env_vars)}")
        overrides.append(f"{prefix}.enabled=true")

    return overrides


def _build_codex_environment(profile: RuntimeProfile) -> dict[str, str]:
    env = os.environ.copy()
    for name in profile.codex_mcp_servers:
        server = _load_claude_mcp_settings().get(name)
        if server:
            _resolve_server_env(server, env)
    return env


def _resolve_server_env(server: dict, env: dict[str, str]) -> list[str]:
    env_vars: list[str] = []
    for target, raw_value in server.get("env", {}).items():
        value = _resolve_env_value(raw_value)
        if value:
            env[target] = value
            env_vars.append(target)
    return env_vars


def _resolve_env_value(raw_value: str) -> str:
    match = _ENV_PLACEHOLDER.match(raw_value)
    if match:
        return os.getenv(match.group(1), "")
    return raw_value


@lru_cache(maxsize=1)
def _load_claude_mcp_settings() -> dict[str, dict]:
    if not _CLAUDE_SETTINGS_PATH.exists():
        return {}
    settings = json.loads(_CLAUDE_SETTINGS_PATH.read_text())
    return settings.get("mcpServers", {})
