"""Core agent runner — spawns coding sessions via the configured runtime."""

from langsmith import traceable

from orchestrator.config import SKILLS_DIR, MEMORY_DIR, AGENT_RUNTIME
from orchestrator.state import FactoryState
from orchestrator.audit import audit_log
from orchestrator.memory import append_memory
from orchestrator.runtime import run_runtime_prompt
from orchestrator.linear import (
    update_linear_state,
    complete_stage_sub_issue,
    update_stage_progress,
    get_issue_id,
    get_issue_context,
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
) -> FactoryState:
    """Spawn an agent session for the given skill and append output to memory."""
    ticket_id = state["ticket_id"]
    memory_content = (MEMORY_DIR / f"{ticket_id}.md").read_text()
    skill_content = (SKILLS_DIR / skill_file).read_text()
    issue_context = await get_issue_context(ticket_id) if AGENT_RUNTIME == "codex" else {}

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
    if AGENT_RUNTIME == "codex":
        comments = issue_context.get("comments", [])
        comment_block = "\n".join(f"- {comment}" for comment in comments) if comments else "- None"
        prompt += (
            "\n\n## Ticket Context From Orchestrator\n\n"
            f"**Ticket Title**: {issue_context.get('title') or state['title']}\n\n"
            f"**Description**:\n{issue_context.get('description') or 'None'}\n\n"
            f"**Recent Comments**:\n{comment_block}\n\n"
            "## Codex Runtime Notes\n\n"
            "- The Linear connector is not available in this runtime. Use the ticket context above instead of trying to read Linear.\n"
            f"- Do not edit any memory files. Return the content for `{memory_section}` in your final response only.\n"
            "- The orchestrator will save your final response and post progress updates for you.\n"
            "- If an external connector is unavailable, continue with the provided context instead of blocking.\n"
        )
    if extra_prompt:
        prompt += f"\n\n{extra_prompt}"

    audit_log(ticket_id, f"agent_start:{memory_section}", skill_file)

    # Post progress to the stage sub-issue
    stage_subs = state.get("stage_sub_issues", {})
    sub_issue_id = stage_subs.get(memory_section, "")
    if sub_issue_id:
        await update_stage_progress(
            ticket_id, memory_section, sub_issue_id,
            f"Agent starting: **{memory_section}**",
        )

    # Post "agent started" to parent issue
    issue_info = await get_issue_id(ticket_id)
    if issue_info:
        await comment_on_issue(
            issue_info["id"],
            f"🟡 **{memory_section}** — agent started.",
        )

    output = await run_runtime_prompt(
        prompt,
        workspace_path,
        "general",
        fallback_output=f"[STUB] {memory_section} completed for {ticket_id}",
        fallback_warning="claude-agent-sdk not available, using stub",
    )

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
    return {**state, "current_state": memory_section}
