# Software Factory — MVF PRD

## What This Is

A self-running software factory. You create a Linear ticket. Agents handle everything from spec to deployed web app. Humans approve at three gates. The factory is simpler than what it builds.

---

## Philosophy

- The factory should be simpler than the product it produces
- 500 lines of orchestrator. 6 skills. 4 MCPs. That's the whole factory.
- Every file should be readable in one sitting
- No clever abstractions. If a new engineer can't understand it in one read, rewrite it
- Append-only memory. Never overwrite. History is sacred.

---

## Repository Structure

```
/
  orchestrator.py          ← the entire LangGraph state machine, 500 lines max
  factory.db               ← SQLite database for LangGraph checkpointer state
  memory/
    _template.md           ← template bootstrapped for each new ticket
    LIN-xxx.md             ← one file per ticket, append-only
  .claude/
    CLAUDE.md              ← master context loaded by every Claude Code session
    settings.json           ← MCP server configuration for all agent sessions
    skills/
      spec-writing.md
      architecture.md
      coding.md
      code-review.md
      test-writing.md
      deploy-checklist.md
  audit/
    YYYY-MM-DD.log         ← one log file per day, every factory event
  app/                     ← the web app being built lives here
  Dockerfile
  docker-compose.yml
  requirements.txt
  .env
```

Everything at repo root. No parent factory directory. The repo is the factory.

---

## The Eleven Primitives

| Primitive | Tool |
|---|---|
| Record | Linear |
| Memory | `memory/` — host mounted volume |
| Orchestrator | LangGraph + LangSmith |
| Execution Env | Docker — host mounted volumes |
| Agent Runtime | Claude Code (via claude-agent-sdk) |
| Integration Layer | 4 MCPs: Linear, GitHub, Railway, Slack |
| Quality Gates | LangGraph interrupts |
| Delivery Target | Railway |
| Observability | Railway logs + Railway MCP |
| Skills | `.claude/` — host mounted volume |
| Identity & Secrets | `.env` — host mounted volume |

---

## Constraints

- Orchestrator: 500 lines maximum, single file
- Skills: 6 skills, one page of markdown each
- MCPs: 4 only — Linear, GitHub, Railway, Slack
- App scope: web apps only, lives in `app/`
- Docker volumes: `memory/`, `.claude/`, `.env`, `factory.db` all mounted from host — never baked into image

---

## Linear Workflow States

These must be created in Linear exactly as named:

```
Backlog → In Spec → In Arch → In Dev → In QA → In Deploy → Done → Blocked
```

A webhook from Linear fires on every state change and triggers the orchestrator.

---

## Agent Roster

Every agent is a Claude Code session (via claude-agent-sdk) running inside a Docker container with:
- The full `memory/{ticket}.md` file as context
- `.claude/CLAUDE.md` loaded automatically
- The relevant skill file for their role
- The 4 MCP connections available

| Agent | Triggered By | Skill | Writes To Memory |
|---|---|---|---|
| PM Agent | `In Spec` | spec-writing.md | `## Spec` |
| Architect Agent | `In Arch` | architecture.md | `## Architecture Decision` |
| Dev Agent | `In Dev` | coding.md | `## Implementation` |
| Review Agent | `In QA` | code-review.md | `## Code Review` |
| Test Agent | `In QA` | test-writing.md | `## Test Results` |
| Deploy Agent | `In Deploy` | deploy-checklist.md | `## Deploy Log` |

Review Agent and Test Agent are both triggered by `In QA` and run in parallel on the same PR. Gate 3 waits for both to complete before proceeding.

---

## The Three Human Gates

Gates are LangGraph `interrupt` nodes. Pipeline pauses, Slack posts, human acts.

| Gate | Trigger | Action To Proceed |
|---|---|---|
| Gate 1 | After PM Agent completes spec | Move Linear ticket to `In Arch` |
| Gate 2 | After Architect Agent completes | Move Linear ticket to `In Dev` |
| Gate 3 | After Review + Test both pass in QA | Move Linear ticket to `In Deploy` |

Human rejects by moving ticket to `Blocked`. Orchestrator stops, posts to Slack, appends error to memory file.

---

## Memory File Schema

One markdown file per ticket. Append-only. Never overwrite.

```markdown
# LIN-xxx — Ticket Title

## Spec
_timestamp_

[PM Agent output]

## Architecture Decision
_timestamp_

[Architect Agent output]

## Implementation
_timestamp_

[Dev Agent output]

## Code Review
_timestamp_

[Review Agent output]

## Test Results
_timestamp_

[Test Agent output]

## Deploy Log
_timestamp_

[Deploy Agent output]

## Error
_timestamp_

[Error description if blocked]
```

---

## Orchestrator Behavior

`orchestrator.py` is a FastAPI app + LangGraph graph in one file.

**FastAPI** exposes two routes:
- `POST /webhook/linear` — receives Linear state change webhooks
- `GET /health` — returns 200

**LangGraph graph** defines:
- One node per agent
- Parallel edges from `dev` to both `review` and `test` (both triggered by `In QA`)
- `interrupt_before` on `gate_1`, `gate_2`, `gate_3`
- `SqliteSaver` as checkpointer — persists graph position per ticket to `factory.db` on a host-mounted volume, survives container restarts
- Conditional edges that route to `blocked` on any agent failure

**On each webhook:**
1. Parse ticket ID, title, new state from Linear payload
2. Map state to agent via `STATE_MAP`
3. Init memory file if first time seeing this ticket
4. Use the ticket ID (e.g. `LIN-123`) as the LangGraph `thread_id`
5. Check if a thread already exists in the checkpointer for this ticket
   - **If interrupted** (waiting at a gate): call `graph.ainvoke(None, {"configurable": {"thread_id": ticket_id}})` to resume from the interrupt
   - **If new**: call `graph.ainvoke(initial_state, {"configurable": {"thread_id": ticket_id}})` to start a new run
6. Run as background task — webhook returns 200 immediately
7. Agent reads full memory file, runs, appends output, advances state

**On agent timeout (5 minutes):**
- Move ticket to `Blocked`
- Post to Slack with timeout reason
- Append error to memory file

**Audit log** — every event written to `audit/YYYY-MM-DD.log`:
```
[timestamp] LIN-xxx | event | detail
```

---

## Docker Setup

### Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install -r requirements.txt
RUN npm install -g @anthropic-ai/claude-code
COPY orchestrator.py .
CMD ["uvicorn", "orchestrator:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml

```yaml
services:
  factory:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./memory:/app/memory
      - ./.claude:/app/.claude
      - ./.env:/app/.env
      - ./app:/app/app
      - ./factory.db:/app/factory.db
    env_file:
      - .env
```

All persistent data lives on the host via volume mounts. Container is fully ephemeral.

---

## .env

```
ANTHROPIC_API_KEY=
LINEAR_API_KEY=
LINEAR_WEBHOOK_SECRET=
GITHUB_TOKEN=
RAILWAY_TOKEN=
SLACK_TOKEN=
SLACK_WEBHOOK_URL=
LANGCHAIN_API_KEY=
LANGCHAIN_TRACING_V2=true
```

---

## requirements.txt

```
fastapi
uvicorn
langgraph
langsmith
claude-agent-sdk
httpx
python-dotenv
aiosqlite
```

---

## MCPs — Four Only

| MCP | Purpose | Auth |
|---|---|---|
| Linear | Create tickets, update states, post comments | `LINEAR_API_KEY` |
| GitHub | Create branches, open PRs, post reviews, merge | `GITHUB_TOKEN` |
| Railway | Trigger deploys, check status, rollback | `RAILWAY_TOKEN` |
| Slack | Post gate notifications, alert on errors | `SLACK_TOKEN` |

MCPs are configured in `.claude/settings.json` and available to every agent session. Each agent can use the Railway MCP to query deploy logs and check for errors directly.

---

## .claude/CLAUDE.md

The master instruction file loaded by every Claude Code agent session. Must contain:

- What the software factory is and how it works
- How to read the memory file
- How to write output — append-only, use the correct section header
- What each MCP connection is for and when to use it
- Where the app lives (`app/`) and what stack it uses
- A reference index to each skill file

---

## .claude/settings.json

MCP server configuration loaded by every Claude Code agent session. Defines the four MCP connections:

```json
{
  "mcpServers": {
    "linear": { ... },
    "github": { ... },
    "railway": { ... },
    "slack": { ... }
  }
}
```

Each MCP server entry specifies the command to start the server and the environment variables it needs (referencing values from `.env`). This file is mounted from the host alongside `CLAUDE.md`.

---

## Skills

Six markdown files. One page each. Loaded by the relevant agent at session start.

**spec-writing.md** — how to turn a raw idea into a structured spec. Required fields: problem statement, proposed solution, acceptance criteria, out of scope, open questions.

**architecture.md** — how to produce a technical architecture decision. Required fields: approach chosen, alternatives considered and rejected, constraints, files and modules affected, dependencies.

**coding.md** — how to write code for this factory's web app. Conventions: Next.js app in `app/`, file naming, component structure, API route patterns, how to commit and open a PR via GitHub MCP.

**code-review.md** — what to check in a PR. Severity levels: blocking, non-blocking, suggestion. Required checks: correctness, security, test coverage, adherence to conventions, no hardcoded secrets.

**test-writing.md** — how to write and run tests. Stack: Jest for frontend, coverage threshold 80%. Required: unit tests for all new functions, integration test for each API route, edge cases documented.

**deploy-checklist.md** — what to verify before and after a Railway deploy. Pre-deploy: tests green, no hardcoded env vars, build passes. Post-deploy: health check passes, no error spike in Railway logs, memory file updated with deploy timestamp and status.

---

## LangSmith Tracing

Set `LANGCHAIN_TRACING_V2=true` and `LANGCHAIN_API_KEY` in `.env`. LangGraph sends traces automatically. Every node execution, state transition, agent decision, and token count is captured. No additional code required.

---

## The Pipeline — End To End

```
Linear ticket created
        ↓
Webhook fires → orchestrator.py
        ↓
PM Agent reads ticket → writes Spec to memory/LIN-xxx.md
        ↓
[GATE 1] Slack notification → human moves ticket to In Arch
        ↓
Architect Agent reads memory → writes Architecture Decision
        ↓
[GATE 2] Slack notification → human moves ticket to In Dev
        ↓
Dev Agent reads memory → writes code to app/ → opens PR → writes Implementation notes
        ↓
Ticket moves to In QA → Review Agent + Test Agent run in parallel on PR
        ↓
[GATE 3] Slack notification → human moves ticket to In Deploy
        ↓
Deploy Agent triggers Railway → writes Deploy Log to memory
        ↓
Ticket moves to Done
```

**Post-deploy observability:** After deploy, agents can query Railway logs via the Railway MCP to check for errors. Any agent that detects a problem can file a new Linear ticket to restart the cycle. This is manual/on-demand in MVF — there is no automated log watcher.

---

## What Does Not Exist In The MVF

- Sentry (Railway logs only for now)
- Doppler (`.env` only for now)
- Vector DB / semantic memory search (flat files only)
- Multi-project support (single `app/` directory)
- Web UI for the factory itself
- Agent-to-agent communication beyond shared memory file
- Automatic PR merge (human controls merge via Gate 3)
- Automated Railway log watcher (agents can query logs on-demand via Railway MCP)