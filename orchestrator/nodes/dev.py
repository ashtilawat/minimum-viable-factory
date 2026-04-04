"""Decomposition and parallel dev agent execution."""

import re
import asyncio

from langsmith import traceable

from orchestrator.config import MEMORY_DIR
from orchestrator.state import FactoryState
from orchestrator.audit import audit_log
from orchestrator.memory import append_memory
from orchestrator.runtime import run_runtime_prompt
from orchestrator.slack import post_slack
from orchestrator.linear import (
    get_issue_id,
    comment_on_issue,
    update_linear_state,
    update_stage_progress,
)
from orchestrator.agent_runner import run_agent


# ---------------------------------------------------------------------------
# Subtask parser
# ---------------------------------------------------------------------------


def parse_subtasks(memory_text: str) -> list[dict]:
    """Parse the ### Subtasks section from the architecture decision in memory."""
    match = re.search(r'### Subtasks\s*\n(.*?)(?=\n###|\n## |\Z)', memory_text, re.DOTALL)
    if not match:
        return []
    section = match.group(1).strip()
    subtasks = []
    for m in re.finditer(r'\d+\.\s+\*\*(.+?)\*\*:\s*(.+?)(?=\n\d+\.|\Z)', section, re.DOTALL):
        subtasks.append({
            "title": m.group(1).strip(),
            "description": m.group(2).strip(),
        })
    return subtasks


# ---------------------------------------------------------------------------
# Decompose node
# ---------------------------------------------------------------------------


@traceable(run_type="chain", name="decompose")
async def decompose(state: FactoryState) -> FactoryState:
    """Parse subtasks from architecture and prepare for parallel dev."""
    ticket_id = state["ticket_id"]
    memory_text = (MEMORY_DIR / f"{ticket_id}.md").read_text()
    subtasks = parse_subtasks(memory_text)

    if not subtasks:
        audit_log(ticket_id, "decompose_fallback", "no subtasks found, running single dev agent")
        return {**state, "subtasks": [], "parent_issue_id": ""}

    # Resolve parent issue ID
    issue_info = await get_issue_id(ticket_id)
    parent_id = issue_info["id"] if issue_info else ""

    # Post decomposition summary on parent ticket
    if parent_id:
        lines = [f"⚪ **Decomposed into {len(subtasks)} subtasks:**"]
        for i, st in enumerate(subtasks, 1):
            lines.append(f"{i}. {st['title']}")
        await comment_on_issue(parent_id, "\n".join(lines))

    # Post to the Implementation stage sub-issue
    stage_subs = state.get("stage_sub_issues", {})
    impl_sub = stage_subs.get("Implementation", "")
    if impl_sub:
        await update_stage_progress(
            ticket_id, "Implementation", impl_sub,
            f"Decomposed into {len(subtasks)} subtasks:\n"
            + "\n".join(f"- {st['title']}" for st in subtasks),
        )

    audit_log(ticket_id, "decompose_done", f"{len(subtasks)} subtasks")
    await post_slack(
        f":white_circle: `{ticket_id}` decomposed into {len(subtasks)} subtasks. "
        f"Dev agents starting in parallel."
    )
    return {**state, "subtasks": subtasks, "parent_issue_id": parent_id}


# ---------------------------------------------------------------------------
# Parallel dev node
# ---------------------------------------------------------------------------


@traceable(run_type="chain", name="dev_parallel")
async def dev_parallel(state: FactoryState) -> FactoryState:
    """Run N dev agents in parallel, one per subtask, all on the same branch."""
    ticket_id = state["ticket_id"]
    subtasks = state.get("subtasks", [])
    parent_id = state.get("parent_issue_id", "")
    stage_subs = state.get("stage_sub_issues", {})
    impl_sub = stage_subs.get("Implementation", "")

    # Fallback: no subtasks means run a single dev agent
    if not subtasks:
        return await run_agent(
            state, "coding/SKILL.md", "Implementation", next_linear_state="In QA"
        )

    # Create the branch once before spawning parallel agents
    branch_name = f"{ticket_id}/implementation"
    workspace_path = state.get("workspace_path", "/app")
    branch_prompt = (
        f"Run these git commands to set up the branch:\n"
        f"git checkout -b {branch_name} 2>/dev/null || git checkout {branch_name}\n"
        f"Just run the commands and confirm the branch is ready."
    )
    await run_runtime_prompt(
        branch_prompt,
        workspace_path,
        "git_only",
        fallback_output="",
        fallback_warning="claude-agent-sdk not available for branch creation",
    )

    audit_log(ticket_id, "dev_parallel_start", f"{len(subtasks)} subtasks")

    @traceable(run_type="chain", name="dev_subtask")
    async def run_subtask(index: int, subtask: dict) -> str:
        subtask_title = subtask["title"]
        subtask_desc = subtask["description"]
        extra = (
            f"## Subtask Scope\n\n"
            f"You are implementing subtask {index + 1} of {len(subtasks)}.\n\n"
            f"**Title**: {subtask_title}\n"
            f"**Scope**: {subtask_desc}\n\n"
            f"**Branch**: `{branch_name}` (already created — just check it out and pull)\n\n"
            f"Implement ONLY the files described in this subtask. "
            f"Commit with message: `{ticket_id}: {subtask_title}`"
        )
        result = await run_agent(state, "coding/SKILL.md", "Implementation", extra_prompt=extra)

        # Post progress to parent and stage sub-issue
        if parent_id:
            await comment_on_issue(
                parent_id,
                f"🟢 Subtask {index + 1}/{len(subtasks)} done: **{subtask_title}**",
            )
        if impl_sub:
            await update_stage_progress(
                ticket_id, "Implementation", impl_sub,
                f"Subtask {index + 1}/{len(subtasks)} complete: **{subtask_title}**",
            )

        audit_log(ticket_id, f"subtask_done:{index + 1}", subtask_title)
        return subtask_title

    # Run all subtasks concurrently
    tasks = [run_subtask(i, st) for i, st in enumerate(subtasks)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Check for failures
    failures = [r for r in results if isinstance(r, Exception)]
    if failures:
        error_msg = f"{len(failures)}/{len(subtasks)} subtasks failed: {failures[0]}"
        audit_log(ticket_id, "dev_parallel_error", error_msg)
        return {**state, "current_state": "Blocked", "error": error_msg}

    # Open a single PR with all changes
    audit_log(ticket_id, "dev_parallel_done", f"all {len(subtasks)} subtasks complete")
    pr_prompt = (
        f"You are working on ticket {ticket_id}: {state['title']}\n\n"
        f"All {len(subtasks)} subtasks have been committed to branch `{branch_name}`.\n\n"
        f"1. Push the branch to origin\n"
        f"2. Open a single PR via GitHub MCP targeting `main` with:\n"
        f"   - Title: `{ticket_id}: {state['title']}`\n"
        f"   - Body summarizing all subtasks that were implemented\n"
        f"3. Post the PR link as a comment on the Linear ticket\n\n"
        f"Return the PR URL."
    )
    pr_text = await run_runtime_prompt(
        pr_prompt,
        workspace_path,
        "pr",
        fallback_output="",
        fallback_warning="claude-agent-sdk not available for PR creation",
    )
    if pr_text:
        append_memory(ticket_id, "Implementation", f"### PR\n{pr_text}")

    await update_linear_state(ticket_id, "In QA")
    if parent_id:
        await comment_on_issue(
            parent_id,
            f"🟢 All {len(subtasks)} subtasks complete. PR opened, moving to QA.",
        )
    if impl_sub:
        await update_stage_progress(
            ticket_id, "Implementation", impl_sub,
            f"All {len(subtasks)} subtasks complete. PR opened.",
        )

    return {**state, "current_state": "Implementation"}
