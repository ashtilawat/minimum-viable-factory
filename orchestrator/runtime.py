"""Runtime adapter for Claude SDK and Codex CLI backends."""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import tempfile
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
    REPO_ROOT,
    logger,
)

RuntimeProfileName = Literal["general", "infra", "git_only", "pr"]

_ENV_PLACEHOLDER = re.compile(r"^\$\{([^}]+)\}$")
_CLAUDE_SETTINGS_PATH = REPO_ROOT / ".claude" / "settings.json"


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
    raise RuntimeError(f"Unsupported AGENT_RUNTIME={AGENT_RUNTIME!r}. Expected 'claude' or 'codex'.")


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


async def _drain_codex_stream(
    stream: asyncio.StreamReader | None,
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
            logger.info("[codex:%s] %s", label, text)
    rest = await stream.read()
    if rest:
        chunks.append(rest)
        tail = rest.decode("utf-8", errors="replace").rstrip("\r\n")
        if tail:
            logger.info("[codex:%s] %s", label, tail)
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
            _drain_codex_stream(process.stdout, "stdout", stream_output=stream_out)
        )
        stderr_task = asyncio.create_task(
            _drain_codex_stream(process.stderr, "stderr", stream_output=stream_out)
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
