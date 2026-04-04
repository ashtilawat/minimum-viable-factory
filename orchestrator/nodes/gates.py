"""Human approval gates — pause the pipeline and wait for Linear state change."""

from langsmith import traceable
from langgraph.types import interrupt

from orchestrator.state import FactoryState
from orchestrator.audit import audit_log
from orchestrator.memory import append_memory
from orchestrator.slack import post_slack
from orchestrator.linear import get_issue_id, comment_on_issue


@traceable(run_type="chain", name="gate")
async def gate(state: FactoryState, gate_name: str, next_state_hint: str) -> FactoryState:
    ticket_id = state["ticket_id"]

    # Post gate reached to Linear
    issue_info = await get_issue_id(ticket_id)
    if issue_info:
        await comment_on_issue(
            issue_info["id"],
            f"🟡 **{gate_name}** — waiting for human approval.\n\n"
            f"Move the ticket to **{next_state_hint}** to proceed, "
            f"or **Blocked** to reject.",
        )

    await post_slack(
        f":large_yellow_circle: *{gate_name}* — `{ticket_id}`: {state['title']}\n"
        f"Review the output and move the ticket to *{next_state_hint}* to proceed, "
        f"or *Blocked* to reject."
    )

    audit_log(ticket_id, gate_name, "waiting for human approval")
    decision = interrupt({"gate": gate_name, "ticket_id": ticket_id})

    if decision == "Blocked":
        error_msg = f"Rejected by human at {gate_name}"
        append_memory(ticket_id, "Error", error_msg)

        if issue_info:
            await comment_on_issue(
                issue_info["id"],
                f"🔴 **{gate_name}** — rejected. Ticket moved to **Blocked**.",
            )

        await post_slack(f":red_circle: `{ticket_id}` blocked at {gate_name}")
        audit_log(ticket_id, "blocked", gate_name)
        return {**state, "current_state": "Blocked", "error": error_msg}

    # Post approval to Linear
    if issue_info:
        await comment_on_issue(
            issue_info["id"],
            f"🟢 **{gate_name}** — approved. Proceeding to **{next_state_hint}**.",
        )

    audit_log(ticket_id, f"{gate_name}_approved", decision)
    return state


async def gate_1(state: FactoryState) -> FactoryState:
    return await gate(state, "Gate 1: Spec Review", "In Arch")


async def gate_2(state: FactoryState) -> FactoryState:
    return await gate(state, "Gate 2: Architecture Review", "In Dev")


async def gate_3(state: FactoryState) -> FactoryState:
    return await gate(state, "Gate 3: QA Review", "In Deploy")
