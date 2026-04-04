"""Linear GraphQL API helpers and sub-issue lifecycle management."""

import httpx
from langsmith import traceable

from orchestrator.config import LINEAR_API_KEY, logger, agent_debug_log
from orchestrator.audit import audit_log

LINEAR_GQL = "https://api.linear.app/graphql"

# Cache: Linear state UUID -> state name
_state_name_cache: dict[str, str] = {}

# Agent stages — one Linear sub-issue is created per stage
AGENT_STAGES = [
    ("Spec", "PM Agent writes a structured spec from the raw ticket"),
    ("Architecture", "Architect Agent produces a technical design and subtask breakdown"),
    ("Implementation", "Dev Agent writes code and opens a PR"),
    ("Code Review", "Review Agent checks correctness, security, and conventions"),
    ("Tests", "Test Agent writes and runs Jest tests"),
    ("Deploy", "Deploy Agent ships to Vercel and verifies health"),
]


# ---------------------------------------------------------------------------
# Low-level GraphQL
# ---------------------------------------------------------------------------


@traceable(run_type="tool", name="linear_gql")
async def _linear_gql(query: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            LINEAR_GQL,
            json={"query": query},
            headers={"Authorization": LINEAR_API_KEY},
        )
    return resp.json() if resp.status_code == 200 else {}


# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------


async def resolve_state_name(state_id: str) -> str | None:
    if state_id in _state_name_cache:
        return _state_name_cache[state_id]
    data = await _linear_gql('{ workflowState(id: "%s") { name } }' % state_id)
    name = data.get("data", {}).get("workflowState", {}).get("name")
    if name:
        _state_name_cache[state_id] = name
    return name


async def _get_state_id(state_name: str) -> str | None:
    data = await _linear_gql(
        '{ workflowStates(filter: { name: { eq: "%s" } }) { nodes { id } } }' % state_name
    )
    nodes = data.get("data", {}).get("workflowStates", {}).get("nodes", [])
    return nodes[0]["id"] if nodes else None


@traceable(run_type="tool", name="linear_update_state")
async def update_linear_state(ticket_id: str, state_name: str) -> None:
    state_uuid = await _get_state_id(state_name)
    if not state_uuid:
        audit_log(ticket_id, "linear_update_failed", f"State '{state_name}' not found")
        return
    number = ticket_id.replace("LIN-", "")
    data = await _linear_gql(
        '{ issues(filter: { number: { eq: %s } }) { nodes { id } } }' % number
    )
    issues = data.get("data", {}).get("issues", {}).get("nodes", [])
    if not issues:
        return
    await _linear_gql(
        'mutation { issueUpdate(id: "%s", input: { stateId: "%s" }) { success } }'
        % (issues[0]["id"], state_uuid)
    )
    audit_log(ticket_id, "linear_state_update", state_name)
    # region agent log
    agent_debug_log(
        "H4",
        "linear.py:update_linear_state",
        "linear_state_update_called",
        {"ticket_id": ticket_id, "state_name": state_name},
    )
    # endregion


# ---------------------------------------------------------------------------
# Issue helpers
# ---------------------------------------------------------------------------


async def get_issue_id(ticket_id: str) -> dict | None:
    """Resolve LIN-xx to a Linear issue UUID + team info."""
    number = ticket_id.replace("LIN-", "")
    data = await _linear_gql(
        '{ issues(filter: { number: { eq: %s } }) { nodes { id team { id } } } }' % number
    )
    nodes = data.get("data", {}).get("issues", {}).get("nodes", [])
    return nodes[0] if nodes else None


async def get_issue_context(ticket_id: str) -> dict:
    """Fetch issue description and recent comments for agent prompts."""
    number = ticket_id.replace("LIN-", "")
    data = await _linear_gql(
        '{ issues(filter: { number: { eq: %s } }) { nodes { id title description comments { nodes { body } } } } }'
        % number
    )
    nodes = data.get("data", {}).get("issues", {}).get("nodes", [])
    if not nodes:
        return {"title": "", "description": "", "comments": []}
    issue = nodes[0]
    comments = [
        node.get("body", "").strip()
        for node in issue.get("comments", {}).get("nodes", [])
        if node.get("body", "").strip()
    ]
    return {
        "title": issue.get("title", ""),
        "description": issue.get("description", "") or "",
        "comments": comments[:10],
    }


@traceable(run_type="tool", name="linear_create_sub_issue")
async def create_sub_issue(
    parent_id: str, team_id: str, title: str, description: str
) -> str | None:
    """Create a Linear sub-issue under a parent. Returns the new issue identifier."""
    safe_title = title.replace('"', '\\"')
    safe_desc = description.replace('"', '\\"').replace("\n", "\\n")
    query = (
        'mutation { issueCreate(input: { '
        'parentId: "%s", teamId: "%s", title: "%s", description: "%s" '
        '}) { success issue { id identifier } } }'
        % (parent_id, team_id, safe_title, safe_desc)
    )
    data = await _linear_gql(query)
    issue = data.get("data", {}).get("issueCreate", {}).get("issue", {})
    return issue.get("identifier")


@traceable(run_type="tool", name="linear_comment")
async def comment_on_issue(issue_id: str, body: str) -> None:
    """Post a comment on a Linear issue."""
    safe_body = body.replace('"', '\\"').replace("\n", "\\n")
    await _linear_gql(
        'mutation { commentCreate(input: { issueId: "%s", body: "%s" }) { success } }'
        % (issue_id, safe_body)
    )


# ---------------------------------------------------------------------------
# Sub-issue-per-agent lifecycle
# ---------------------------------------------------------------------------


@traceable(run_type="chain", name="ensure_stage_sub_issues")
async def ensure_stage_sub_issues(ticket_id: str) -> dict[str, str]:
    """Create one sub-issue per agent stage. Returns {stage_name: sub_issue_identifier}.

    Idempotent — if sub-issues already exist (checked by title prefix), skips creation.
    """
    issue_info = await get_issue_id(ticket_id)
    if not issue_info:
        logger.warning("Could not resolve %s to create stage sub-issues", ticket_id)
        return {}

    parent_id = issue_info["id"]
    team_id = issue_info.get("team", {}).get("id", "")
    if not team_id:
        return {}

    # Check for existing sub-issues to make this idempotent
    data = await _linear_gql(
        '{ issue(id: "%s") { children { nodes { identifier title } } } }' % parent_id
    )
    existing = data.get("data", {}).get("issue", {}).get("children", {}).get("nodes", [])
    existing_titles = {node["title"] for node in existing}

    mapping: dict[str, str] = {}
    for stage_name, stage_desc in AGENT_STAGES:
        sub_title = f"[{stage_name}] {ticket_id}"
        # Skip if already exists
        if sub_title in existing_titles:
            for node in existing:
                if node["title"] == sub_title:
                    mapping[stage_name] = node["identifier"]
            continue
        sub_id = await create_sub_issue(parent_id, team_id, sub_title, stage_desc)
        if sub_id:
            mapping[stage_name] = sub_id
            audit_log(ticket_id, "stage_sub_issue_created", f"{stage_name} -> {sub_id}")

    # Post a summary comment on the parent
    if mapping:
        lines = [
            "⚪ **Pipeline started.**\n",
            "This ticket will be built automatically through 6 stages, "
            "with 3 human approval gates. Each stage has its own sub-issue "
            "for detailed tracking.\n",
            "**Stages:**",
        ]
        for stage_name, sub_id in mapping.items():
            lines.append(f"- [ ] **{stage_name}** ({sub_id})")
        await comment_on_issue(parent_id, "\n".join(lines))

    audit_log(ticket_id, "stage_sub_issues_ready", f"{len(mapping)} stages")
    return mapping


@traceable(run_type="tool", name="complete_stage_sub_issue")
async def complete_stage_sub_issue(ticket_id: str, stage_name: str, sub_issue_id: str) -> None:
    """Mark a stage sub-issue as Done."""
    # Resolve the sub-issue's internal ID from its identifier
    number = sub_issue_id.replace("LIN-", "")
    data = await _linear_gql(
        '{ issues(filter: { number: { eq: %s } }) { nodes { id } } }' % number
    )
    nodes = data.get("data", {}).get("issues", {}).get("nodes", [])
    if not nodes:
        return

    sub_uuid = nodes[0]["id"]

    # Move to Done
    done_id = await _get_state_id("Done")
    if done_id:
        await _linear_gql(
            'mutation { issueUpdate(id: "%s", input: { stateId: "%s" }) { success } }'
            % (sub_uuid, done_id)
        )

    audit_log(ticket_id, "stage_complete", f"{stage_name} ({sub_issue_id})")


@traceable(run_type="tool", name="update_stage_progress")
async def update_stage_progress(
    ticket_id: str, stage_name: str, sub_issue_id: str, message: str
) -> None:
    """Post a progress update as a comment on a stage sub-issue."""
    number = sub_issue_id.replace("LIN-", "")
    data = await _linear_gql(
        '{ issues(filter: { number: { eq: %s } }) { nodes { id } } }' % number
    )
    nodes = data.get("data", {}).get("issues", {}).get("nodes", [])
    if not nodes:
        return
    await comment_on_issue(nodes[0]["id"], message)
    audit_log(ticket_id, f"stage_progress:{stage_name}", message[:100])
