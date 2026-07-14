"""Thin wrappers that call run_agent with the correct skill file."""

from orchestrator.state import FactoryState
from orchestrator.agent_runner import run_agent


async def pm_agent(state: FactoryState) -> FactoryState:
    return await run_agent(state, "spec-writing/SKILL.md", "Spec")


async def architect_agent(state: FactoryState) -> FactoryState:
    return await run_agent(state, "architecture/SKILL.md", "Architecture Decision")


async def review_agent(state: FactoryState) -> FactoryState:
    # review + test fan in to gate_3 — both set the same current_state so the
    # reducer merge is deterministic regardless of finish order.
    return await run_agent(
        state, "code-review/SKILL.md", "Code Review", result_state="In QA"
    )


async def test_agent(state: FactoryState) -> FactoryState:
    return await run_agent(
        state, "test-writing/SKILL.md", "Test Results", result_state="In QA"
    )


async def deploy_agent(state: FactoryState) -> FactoryState:
    return await run_agent(
        state, "deploy-checklist/SKILL.md", "Deploy Log", next_linear_state="Done"
    )
