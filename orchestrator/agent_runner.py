"""Core agent runner — spawns Claude Code sessions via claude-agent-sdk."""

import asyncio

from langsmith import traceable

from orchestrator.config import SKILLS_DIR, MEMORY_DIR, AGENT_TIMEOUT, logger
from orchestrator.state import FactoryState
from orchestrator.audit import audit_log
from orchestrator.memory import append_memory
from orchestrator.linear import (
    update_linear_state,
    complete_stage_sub_issue,
    update_stage_progress,
    get_issue_id,
    comment_on_issue,
)


def _excerpt(text: str, max_lines: int = 30) -> str:
    """Extract a meaningful excerpt from agent output for Linear comments."""
    lines = text.strip().splitlines()
    meaningful = [l for l in lines if l.strip() and not l.startswith("[STUB]")]
    if len(meaningful) <= max_lines:
        return "\n".join(meaningful)
    return "\n".join(meaningful[:max_lines]) + f"\n\n_(truncated — {len(meaningful)} lines total)_"


@traceable(run_type="chain", name="run_agent")
async def run_agent(
    state: FactoryState,
    skill_file: str,
    memory_section: str,
    next_linear_state: str | None = None,
    extra_prompt: str = "",
    post_updates: bool = True,
    result_state: str | None = None,
) -> FactoryState:
    """Spawn a Claude Code session for the given skill and append output to memory.

    When ``post_updates`` is False the caller owns the Linear sub-issue lifecycle
    (start/progress/done) — used by parallel dev so N subtasks don't each start,
    comment on, and prematurely close the single Implementation sub-issue.

    ``result_state`` is written to ``current_state``. Parallel branches that
    fan in (review + test) must pass the SAME value so the merge is
    deterministic regardless of which finishes first. Defaults to the section.
    """
    ticket_id = state["ticket_id"]
    memory_content = (MEMORY_DIR / f"{ticket_id}.md").read_text()
    skill_content = (SKILLS_DIR / skill_file).read_text()

    repo_name = state.get("repo_name", "")
    workspace_path = state.get("workspace_path", "/app")

    prompt = (
        f"You are working on ticket {ticket_id}: {state['title']}\n\n"
        f"**Repo**: `{repo_name}`\n"
        f"**Workspace**: `{workspace_path}`\n\n"
        f"All code changes go in this workspace directory — it is the root of the app repo.\n\n"
        f"## Memory File\n\n{memory_content}\n\n"
        f"## Your Skill Instructions\n\n{skill_content}"
    )
    if extra_prompt:
        prompt += f"\n\n{extra_prompt}"

    audit_log(ticket_id, f"agent_start:{memory_section}", skill_file)

    # Post progress to the stage sub-issue
    stage_subs = state.get("stage_sub_issues", {})
    sub_issue_id = stage_subs.get(memory_section, "") if post_updates else ""
    if sub_issue_id:
        await update_stage_progress(
            ticket_id, memory_section, sub_issue_id,
            f"Agent starting: **{memory_section}**",
        )

    # Post "agent started" to parent issue
    issue_info = await get_issue_id(ticket_id) if post_updates else None
    if issue_info:
        await comment_on_issue(
            issue_info["id"],
            f"🟡 **{memory_section}** — agent started.",
        )

    try:
        from claude_agent_sdk import query as claude_query, ClaudeAgentOptions

        options = ClaudeAgentOptions(
            cwd=workspace_path,
            permission_mode="bypassPermissions",
            allowed_tools=[
                "Read", "Write", "Edit", "Bash", "Glob", "Grep",
                "mcp__linear__*", "mcp__github__*",
                "mcp__vercel__*", "mcp__supabase__*", "mcp__slack__*",
            ],
        )
        async def _collect() -> list[str]:
            parts: list[str] = []
            async for message in claude_query(prompt=prompt, options=options):
                if hasattr(message, "content"):
                    for block in message.content:
                        if hasattr(block, "text"):
                            parts.append(block.text)
            return parts

        # Bound each agent individually so one stalled session can't hold up the
        # whole graph. A timeout propagates to run_pipeline -> handle_timeout.
        output_parts = await asyncio.wait_for(_collect(), timeout=AGENT_TIMEOUT)
        output = "\n".join(output_parts)
    except ImportError:
        output = f"[STUB] {memory_section} completed for {ticket_id}"
        logger.warning("claude-agent-sdk not available, using stub")

    append_memory(ticket_id, memory_section, output)

    if next_linear_state:
        await update_linear_state(ticket_id, next_linear_state)

    # Post agent output summary to the parent issue
    if issue_info:
        excerpt = _excerpt(output)
        await comment_on_issue(
            issue_info["id"],
            f"🟢 **{memory_section}** — complete.\n\n{excerpt}",
        )

    # Post full output to the stage sub-issue and mark it done
    if sub_issue_id:
        await update_stage_progress(
            ticket_id, memory_section, sub_issue_id,
            f"Agent finished. Output:\n\n{_excerpt(output, max_lines=50)}",
        )
        await complete_stage_sub_issue(ticket_id, memory_section, sub_issue_id)

    audit_log(ticket_id, f"agent_done:{memory_section}", f"{len(output)} chars")
    return {**state, "current_state": result_state or memory_section}
