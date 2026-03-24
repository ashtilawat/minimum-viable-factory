"""Software Factory Orchestrator — FastAPI + LangGraph in one file."""

import os
import asyncio
import json
import hmac
import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path
import re
from typing import TypedDict, Annotated, Any
from contextlib import asynccontextmanager
from operator import itemgetter

from dotenv import load_dotenv
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
import httpx
from langgraph.graph import StateGraph, END
from langgraph.types import interrupt, Command
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langsmith import traceable

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MEMORY_DIR = Path("memory")
AUDIT_DIR = Path("audit")
TEMPLATE_PATH = MEMORY_DIR / "_template.md"
SKILLS_DIR = Path(".claude/skills")
DB_PATH = "factory.db"

LINEAR_API_KEY = os.getenv("LINEAR_API_KEY", "")
LINEAR_WEBHOOK_SECRET = os.getenv("LINEAR_WEBHOOK_SECRET", "")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
AGENT_TIMEOUT = 1800  # 30 minutes

logger = logging.getLogger("factory")
logging.basicConfig(level=logging.INFO)

# Cache: Linear state UUID -> state name
_state_name_cache: dict[str, str] = {}

# Track threads with an active pipeline run to prevent concurrent updates
_active_threads: set[str] = set()

# ---------------------------------------------------------------------------
# State map: Linear state name -> graph node(s)
# ---------------------------------------------------------------------------

STATE_MAP: dict[str, str] = {
    "In Spec": "pm_agent",
    "In Arch": "architect_agent",
    "In Dev": "decompose",
    "In QA": "qa_fanout",
    "In Deploy": "deploy_agent",
}


# ---------------------------------------------------------------------------
# LangGraph state schema
# ---------------------------------------------------------------------------


def _last(a: str, b: str) -> str:
    """Reducer: keep the last non-empty value. Allows parallel branches to merge."""
    return b if b else a


def _last_list(a: list, b: list) -> list:
    """Reducer: keep the last non-empty list."""
    return b if b else a


class FactoryState(TypedDict):
    ticket_id: Annotated[str, _last]
    title: Annotated[str, _last]
    current_state: Annotated[str, _last]
    error: Annotated[str, _last]
    parent_issue_id: Annotated[str, _last]
    subtasks: Annotated[list[dict], _last_list]


# ---------------------------------------------------------------------------
# Audit logging
# ---------------------------------------------------------------------------


def audit_log(ticket_id: str, event: str, detail: str = "") -> None:
    AUDIT_DIR.mkdir(exist_ok=True)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ts = datetime.now(timezone.utc).isoformat()
    line = f"[{ts}] {ticket_id} | {event} | {detail}\n"
    (AUDIT_DIR / f"{today}.log").open("a").write(line)
    logger.info(line.strip())


# ---------------------------------------------------------------------------
# Memory helpers
# ---------------------------------------------------------------------------


def init_memory(ticket_id: str, title: str) -> Path:
    path = MEMORY_DIR / f"{ticket_id}.md"
    if path.exists():
        return path
    MEMORY_DIR.mkdir(exist_ok=True)
    template = TEMPLATE_PATH.read_text()
    content = template.replace("{{TICKET_ID}}", ticket_id).replace("{{TICKET_TITLE}}", title)
    path.write_text(content)
    audit_log(ticket_id, "memory_init", str(path))
    return path


def append_memory(ticket_id: str, section: str, content: str) -> None:
    path = MEMORY_DIR / f"{ticket_id}.md"
    ts = datetime.now(timezone.utc).isoformat()
    text = path.read_text()
    marker = f"## {section}"
    if marker in text:
        text = text.replace(
            f"{marker}\n_pending_",
            f"{marker}\n_{ts}_\n\n{content}",
        )
        path.write_text(text)
    else:
        with path.open("a") as f:
            f.write(f"\n{marker}\n_{ts}_\n\n{content}\n")
    audit_log(ticket_id, f"memory_append:{section}", f"{len(content)} chars")


# ---------------------------------------------------------------------------
# Linear API helpers
# ---------------------------------------------------------------------------

LINEAR_GQL = "https://api.linear.app/graphql"


async def _linear_gql(query: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(LINEAR_GQL, json={"query": query}, headers={"Authorization": LINEAR_API_KEY})
    return resp.json() if resp.status_code == 200 else {}


async def resolve_state_name(state_id: str) -> str | None:
    if state_id in _state_name_cache:
        return _state_name_cache[state_id]
    data = await _linear_gql('{ workflowState(id: "%s") { name } }' % state_id)
    name = data.get("data", {}).get("workflowState", {}).get("name")
    if name:
        _state_name_cache[state_id] = name
    return name


async def update_linear_state(ticket_id: str, state_name: str) -> None:
    data = await _linear_gql('{ workflowStates(filter: { name: { eq: "%s" } }) { nodes { id } } }' % state_name)
    nodes = data.get("data", {}).get("workflowStates", {}).get("nodes", [])
    if not nodes:
        audit_log(ticket_id, "linear_update_failed", f"State '{state_name}' not found")
        return
    number = ticket_id.replace("LIN-", "")
    data = await _linear_gql('{ issues(filter: { number: { eq: %s } }) { nodes { id } } }' % number)
    issues = data.get("data", {}).get("issues", {}).get("nodes", [])
    if not issues:
        return
    await _linear_gql('mutation { issueUpdate(id: "%s", input: { stateId: "%s" }) { success } }' % (issues[0]["id"], nodes[0]["id"]))
    audit_log(ticket_id, "linear_state_update", state_name)


async def get_issue_id(ticket_id: str) -> str | None:
    """Resolve LIN-xx to a Linear issue UUID."""
    number = ticket_id.replace("LIN-", "")
    data = await _linear_gql('{ issues(filter: { number: { eq: %s } }) { nodes { id team { id } } } }' % number)
    nodes = data.get("data", {}).get("issues", {}).get("nodes", [])
    return nodes[0] if nodes else None


async def create_sub_issue(parent_id: str, team_id: str, title: str, description: str) -> str | None:
    """Create a Linear sub-issue under a parent issue. Returns the new issue's identifier."""
    # Escape quotes in title and description for GraphQL
    safe_title = title.replace('"', '\\"')
    safe_desc = description.replace('"', '\\"').replace("\n", "\\n")
    query = (
        'mutation { issueCreate(input: { '
        'parentId: "%s", teamId: "%s", title: "%s", description: "%s" '
        '}) { success issue { id identifier } } }' % (parent_id, team_id, safe_title, safe_desc)
    )
    data = await _linear_gql(query)
    issue = data.get("data", {}).get("issueCreate", {}).get("issue", {})
    return issue.get("identifier")


async def comment_on_issue(issue_id: str, body: str) -> None:
    """Post a comment on a Linear issue."""
    safe_body = body.replace('"', '\\"').replace("\n", "\\n")
    await _linear_gql('mutation { commentCreate(input: { issueId: "%s", body: "%s" }) { success } }' % (issue_id, safe_body))


# ---------------------------------------------------------------------------
# Subtask parser
# ---------------------------------------------------------------------------


def parse_subtasks(memory_text: str) -> list[dict]:
    """Parse the ### Subtasks section from the architecture decision in memory."""
    # Find the ### Subtasks section
    match = re.search(r'### Subtasks\s*\n(.*?)(?=\n###|\n## |\Z)', memory_text, re.DOTALL)
    if not match:
        return []
    section = match.group(1).strip()
    subtasks = []
    # Match numbered items like: 1. **Title**: Description
    for m in re.finditer(r'\d+\.\s+\*\*(.+?)\*\*:\s*(.+?)(?=\n\d+\.|\Z)', section, re.DOTALL):
        subtasks.append({
            "title": m.group(1).strip(),
            "description": m.group(2).strip(),
        })
    return subtasks


# ---------------------------------------------------------------------------
# Slack helper
# ---------------------------------------------------------------------------


async def post_slack(message: str) -> None:
    if not SLACK_WEBHOOK_URL:
        logger.warning("SLACK_WEBHOOK_URL not set, skipping: %s", message)
        return
    async with httpx.AsyncClient() as client:
        await client.post(SLACK_WEBHOOK_URL, json={"text": message})


# ---------------------------------------------------------------------------
# Agent runner
# ---------------------------------------------------------------------------


@traceable(run_type="chain")
async def run_agent(
    state: FactoryState, skill_file: str, memory_section: str,
    next_linear_state: str | None = None,
    extra_prompt: str = "",
) -> FactoryState:
    """Spawn a Claude Code session for the given skill and append output to memory."""
    ticket_id = state["ticket_id"]
    memory_content = (MEMORY_DIR / f"{ticket_id}.md").read_text()
    skill_content = (SKILLS_DIR / skill_file).read_text()
    prompt = (
        f"You are working on ticket {ticket_id}: {state['title']}\n\n"
        f"## Memory File\n\n{memory_content}\n\n"
        f"## Your Skill Instructions\n\n{skill_content}"
    )
    if extra_prompt:
        prompt += f"\n\n{extra_prompt}"
    audit_log(ticket_id, f"agent_start:{memory_section}", skill_file)
    try:
        from claude_agent_sdk import query as claude_query, ClaudeAgentOptions
        options = ClaudeAgentOptions(
            cwd="/app",
            permission_mode="bypassPermissions",
            allowed_tools=[
                "Read", "Write", "Edit", "Bash", "Glob", "Grep",
                "mcp__linear__*", "mcp__github__*",
                "mcp__railway__*", "mcp__slack__*",
            ],
        )
        output_parts: list[str] = []
        async for message in claude_query(prompt=prompt, options=options):
            if hasattr(message, "content"):
                for block in message.content:
                    if hasattr(block, "text"):
                        output_parts.append(block.text)
        output = "\n".join(output_parts)
    except ImportError:
        output = f"[STUB] {memory_section} completed for {ticket_id}"
        logger.warning("claude-agent-sdk not available, using stub")
    append_memory(ticket_id, memory_section, output)
    if next_linear_state:
        await update_linear_state(ticket_id, next_linear_state)
    audit_log(ticket_id, f"agent_done:{memory_section}", f"{len(output)} chars")
    return {**state, "current_state": memory_section}


# ---------------------------------------------------------------------------
# Agent node functions
# ---------------------------------------------------------------------------


async def pm_agent(state: FactoryState) -> FactoryState:
    return await run_agent(state, "spec-writing/SKILL.md", "Spec")

async def architect_agent(state: FactoryState) -> FactoryState:
    return await run_agent(state, "architecture/SKILL.md", "Architecture Decision")


async def decompose(state: FactoryState) -> FactoryState:
    """Parse subtasks from architecture, create Linear sub-issues, create git branch."""
    ticket_id = state["ticket_id"]
    memory_text = (MEMORY_DIR / f"{ticket_id}.md").read_text()
    subtasks = parse_subtasks(memory_text)

    if not subtasks:
        audit_log(ticket_id, "decompose_fallback", "no subtasks found, running single dev agent")
        return {**state, "subtasks": [], "parent_issue_id": ""}

    # Resolve parent issue ID
    issue_info = await get_issue_id(ticket_id)
    parent_id = issue_info["id"] if issue_info else ""
    team_id = issue_info.get("team", {}).get("id", "") if issue_info else ""

    # Create sub-issues in Linear
    for i, st in enumerate(subtasks):
        if parent_id and team_id:
            sub_id = await create_sub_issue(parent_id, team_id, st["title"], st["description"])
            st["sub_issue_id"] = sub_id or ""
            audit_log(ticket_id, "sub_issue_created", f"{sub_id}: {st['title']}")
        else:
            st["sub_issue_id"] = ""

    # Post summary comment on parent ticket
    if parent_id:
        lines = [f"**Decomposed into {len(subtasks)} subtasks:**"]
        for i, st in enumerate(subtasks, 1):
            sub_ref = f" ({st['sub_issue_id']})" if st.get("sub_issue_id") else ""
            lines.append(f"{i}. {st['title']}{sub_ref}")
        await comment_on_issue(parent_id, "\n".join(lines))

    # Create the shared git branch via a lightweight agent
    audit_log(ticket_id, "decompose_done", f"{len(subtasks)} subtasks")
    await post_slack(
        f":scissors: `{ticket_id}` decomposed into {len(subtasks)} subtasks. "
        f"Dev agents starting in parallel."
    )
    return {**state, "subtasks": subtasks, "parent_issue_id": parent_id}


async def dev_parallel(state: FactoryState) -> FactoryState:
    """Run N dev agents in parallel, one per subtask, all on the same branch."""
    ticket_id = state["ticket_id"]
    subtasks = state.get("subtasks", [])
    parent_id = state.get("parent_issue_id", "")

    # Fallback: no subtasks means run a single dev agent (legacy behavior)
    if not subtasks:
        return await run_agent(state, "coding/SKILL.md", "Implementation", next_linear_state="In QA")

    # Create the branch once before spawning parallel agents
    branch_name = f"{ticket_id}/implementation"
    try:
        from claude_agent_sdk import query as claude_query, ClaudeAgentOptions
        options = ClaudeAgentOptions(
            cwd="/app",
            permission_mode="bypassPermissions",
            allowed_tools=["Bash"],
        )
        branch_prompt = (
            f"Run these git commands to set up the branch:\n"
            f"cd /app/app && git checkout -b {branch_name} 2>/dev/null || git checkout {branch_name}\n"
            f"Just run the commands and confirm the branch is ready."
        )
        async for _ in claude_query(prompt=branch_prompt, options=options):
            pass
    except ImportError:
        logger.warning("claude-agent-sdk not available for branch creation")

    audit_log(ticket_id, "dev_parallel_start", f"{len(subtasks)} subtasks")

    async def run_subtask(index: int, subtask: dict) -> str:
        """Run a single subtask dev agent."""
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
        section_name = f"Implementation"
        result = await run_agent(
            state, "coding/SKILL.md", section_name,
            extra_prompt=extra,
        )
        # Post progress comment on parent ticket
        if parent_id:
            await comment_on_issue(
                parent_id,
                f"✓ Subtask {index + 1}/{len(subtasks)} done: **{subtask_title}**"
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
    try:
        from claude_agent_sdk import query as claude_query, ClaudeAgentOptions
        options = ClaudeAgentOptions(
            cwd="/app",
            permission_mode="bypassPermissions",
            allowed_tools=["Bash", "Read", "Glob", "mcp__github__*", "mcp__linear__*"],
        )
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
        pr_output = []
        async for message in claude_query(prompt=pr_prompt, options=options):
            if hasattr(message, "content"):
                for block in message.content:
                    if hasattr(block, "text"):
                        pr_output.append(block.text)
        pr_text = "\n".join(pr_output)
        append_memory(ticket_id, "Implementation", f"### PR\n{pr_text}")
    except ImportError:
        logger.warning("claude-agent-sdk not available for PR creation")

    await update_linear_state(ticket_id, "In QA")
    if parent_id:
        await comment_on_issue(parent_id, f"✅ All {len(subtasks)} subtasks complete. PR opened, moving to QA.")

    return {**state, "current_state": "Implementation"}


async def review_agent(state: FactoryState) -> FactoryState:
    return await run_agent(state, "code-review/SKILL.md", "Code Review")

async def test_agent(state: FactoryState) -> FactoryState:
    return await run_agent(state, "test-writing/SKILL.md", "Test Results")

async def deploy_agent(state: FactoryState) -> FactoryState:
    return await run_agent(state, "deploy-checklist/SKILL.md", "Deploy Log", next_linear_state="Done")


# ---------------------------------------------------------------------------
# Gate node functions
# ---------------------------------------------------------------------------


@traceable(run_type="chain")
async def gate(state: FactoryState, gate_name: str, next_state_hint: str) -> FactoryState:
    ticket_id = state["ticket_id"]
    await post_slack(
        f":factory: *{gate_name}* — `{ticket_id}`: {state['title']}\n"
        f"Review the output and move the ticket to *{next_state_hint}* to proceed, "
        f"or *Blocked* to reject."
    )
    audit_log(ticket_id, gate_name, "waiting for human approval")

    decision = interrupt({"gate": gate_name, "ticket_id": ticket_id})

    if decision == "Blocked":
        error_msg = f"Rejected by human at {gate_name}"
        append_memory(ticket_id, "Error", error_msg)
        await post_slack(f":x: `{ticket_id}` blocked at {gate_name}")
        audit_log(ticket_id, "blocked", gate_name)
        return {**state, "current_state": "Blocked", "error": error_msg}

    audit_log(ticket_id, f"{gate_name}_approved", decision)
    return state


async def gate_1(state: FactoryState) -> FactoryState:
    return await gate(state, "Gate 1: Spec Review", "In Arch")


async def gate_2(state: FactoryState) -> FactoryState:
    return await gate(state, "Gate 2: Architecture Review", "In Dev")


async def gate_3(state: FactoryState) -> FactoryState:
    return await gate(state, "Gate 3: QA Review", "In Deploy")


# ---------------------------------------------------------------------------
# Terminal nodes
# ---------------------------------------------------------------------------


async def done_handler(state: FactoryState) -> FactoryState:
    ticket_id = state["ticket_id"]
    await post_slack(f":white_check_mark: `{ticket_id}`: {state['title']} — deployed successfully!")
    audit_log(ticket_id, "done", "pipeline complete")
    return {**state, "current_state": "Done"}


async def blocked_handler(state: FactoryState) -> FactoryState:
    ticket_id = state["ticket_id"]
    await update_linear_state(ticket_id, "Blocked")
    await post_slack(f":x: `{ticket_id}` is blocked: {state.get('error', 'unknown')}")
    audit_log(ticket_id, "blocked", state.get("error", ""))
    return state


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------


def should_block(state: FactoryState) -> str:
    if state.get("error") or state.get("current_state") == "Blocked":
        return "blocked_handler"
    return "continue"


def qa_fanout(state: FactoryState) -> list[str]:
    """After dev_parallel, fan out to both QA agents or block."""
    if state.get("error") or state.get("current_state") == "Blocked":
        return ["blocked_handler"]
    return ["review_agent", "test_agent"]


builder = StateGraph(FactoryState)

# Nodes
builder.add_node("pm_agent", pm_agent)
builder.add_node("gate_1", gate_1)
builder.add_node("architect_agent", architect_agent)
builder.add_node("gate_2", gate_2)
builder.add_node("decompose", decompose)
builder.add_node("dev_parallel", dev_parallel)
builder.add_node("review_agent", review_agent)
builder.add_node("test_agent", test_agent)
builder.add_node("gate_3", gate_3)
builder.add_node("deploy_agent", deploy_agent)
builder.add_node("done_handler", done_handler)
builder.add_node("blocked_handler", blocked_handler)

# Edges: Spec → Gate 1 → Arch → Gate 2 → Decompose → Parallel Dev → QA → Gate 3 → Deploy
builder.set_entry_point("pm_agent")
builder.add_conditional_edges("pm_agent", should_block, {"blocked_handler": "blocked_handler", "continue": "gate_1"})
builder.add_edge("gate_1", "architect_agent")
builder.add_conditional_edges("architect_agent", should_block, {"blocked_handler": "blocked_handler", "continue": "gate_2"})
builder.add_edge("gate_2", "decompose")
builder.add_edge("decompose", "dev_parallel")

# Fan-out: dev_parallel -> review + test in parallel (or block)
builder.add_conditional_edges("dev_parallel", qa_fanout)

# Fan-in: both QA agents -> gate_3
builder.add_edge("review_agent", "gate_3")
builder.add_edge("test_agent", "gate_3")

builder.add_edge("gate_3", "deploy_agent")
builder.add_conditional_edges("deploy_agent", should_block, {"blocked_handler": "blocked_handler", "continue": "done_handler"})
builder.add_edge("done_handler", END)
builder.add_edge("blocked_handler", END)

# Graph is compiled in the lifespan with the checkpointer
graph = None


# ---------------------------------------------------------------------------
# Error / timeout handlers
# ---------------------------------------------------------------------------


async def handle_timeout(ticket_id: str) -> None:
    minutes = AGENT_TIMEOUT // 60
    append_memory(ticket_id, "Error", f"Agent timed out after {minutes} minutes")
    await update_linear_state(ticket_id, "Blocked")
    await post_slack(f":warning: `{ticket_id}` — agent timed out after {minutes} minutes. Ticket moved to Blocked.")
    audit_log(ticket_id, "timeout", f"{minutes} minute limit exceeded")


async def handle_error(ticket_id: str, error: str) -> None:
    append_memory(ticket_id, "Error", f"Pipeline error: {error}")
    await update_linear_state(ticket_id, "Blocked")
    await post_slack(f":x: `{ticket_id}` — pipeline error: {error}")
    audit_log(ticket_id, "error", error)


# ---------------------------------------------------------------------------
# Pipeline runner (background task)
# ---------------------------------------------------------------------------


@traceable(run_type="chain", name="run_pipeline")
async def run_pipeline(ticket_id: str, title: str, state_name: str) -> None:
    # Prevent concurrent graph updates on the same thread
    if ticket_id in _active_threads:
        audit_log(ticket_id, "pipeline_skip", f"already running, ignoring {state_name}")
        return
    _active_threads.add(ticket_id)
    config = {"configurable": {"thread_id": ticket_id}}
    try:
        # Check if there is an existing interrupted thread for this ticket
        existing = await graph.aget_state(config)
        if existing and existing.values and existing.tasks:
            # Resume from interrupt — pass the new state name so the gate
            # node knows what the human decided
            audit_log(ticket_id, "pipeline_resume", state_name)
            await asyncio.wait_for(
                graph.ainvoke(Command(resume=state_name), config),
                timeout=AGENT_TIMEOUT,
            )
        else:
            # New ticket — start the pipeline from scratch
            initial: FactoryState = {
                "ticket_id": ticket_id,
                "title": title,
                "current_state": state_name,
                "error": "",
                "parent_issue_id": "",
                "subtasks": [],
            }
            audit_log(ticket_id, "pipeline_start", state_name)
            await asyncio.wait_for(
                graph.ainvoke(initial, config),
                timeout=AGENT_TIMEOUT,
            )
        audit_log(ticket_id, "pipeline_step_complete", state_name)
    except asyncio.TimeoutError:
        await handle_timeout(ticket_id)
    except Exception as e:
        await handle_error(ticket_id, str(e))
    finally:
        _active_threads.discard(ticket_id)


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    global graph
    async with AsyncSqliteSaver.from_conn_string(DB_PATH) as checkpointer:
        graph = builder.compile(checkpointer=checkpointer)
        logger.info("Factory orchestrator started, graph compiled with SQLite checkpointer")
        yield


app = FastAPI(title="Software Factory", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/webhook/linear")
async def webhook_linear(request: Request, background_tasks: BackgroundTasks):
    body = await request.body()

    # TODO: Re-enable after fixing signature verification
    # Verify webhook signature — Linear signs the raw body with HMAC-SHA256
    # if LINEAR_WEBHOOK_SECRET:
    #     signature = request.headers.get("linear-signature", "")
    #     expected = hmac.new(
    #         LINEAR_WEBHOOK_SECRET.strip().encode(), body, hashlib.sha256
    #     ).hexdigest()
    #     if not hmac.compare_digest(signature, expected):
    #         raise HTTPException(status_code=401, detail="Invalid signature")

    payload = json.loads(body)

    # Only process issue state changes
    if payload.get("type") != "Issue" or payload.get("action") != "update":
        return {"ok": True, "skipped": True}

    data = payload.get("data", {})
    state_id = data.get("stateId")
    if not state_id:
        return {"ok": True, "skipped": True}

    # Resolve the Linear state name from UUID
    state_name = await resolve_state_name(state_id)
    if not state_name or state_name not in STATE_MAP:
        return {"ok": True, "skipped": True, "state": state_name}

    # Extract ticket info
    ticket_number = data.get("number")
    ticket_id = f"LIN-{ticket_number}"
    title = data.get("title", "Untitled")

    audit_log(ticket_id, "webhook_received", f"{state_name} (stateId={state_id})")

    # Initialize memory file if this is a new ticket
    init_memory(ticket_id, title)

    # Run the pipeline in the background so the webhook returns immediately
    background_tasks.add_task(run_pipeline, ticket_id, title, state_name)

    return {"ok": True, "ticket": ticket_id, "state": state_name}
