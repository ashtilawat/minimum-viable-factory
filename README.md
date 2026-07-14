# Minimum Viable Factory

Ticket in, deployed web app out. The full SDLC — spec, architecture, code, review, tests, deploy — handled by Claude Code agents running in parallel. You approve at three gates.

**~700 lines of Python across 16 modules. 6 skills. 5 MCPs. You can read every file in one sitting.**

Right now this factory greenfields web apps from idea to production. You describe what you want, agents build and deploy it from scratch. Each app gets its own GitHub repo, scaffolded as a Next.js + TypeScript + Tailwind + Jest project at creation. Large tasks are automatically decomposed into subtasks and built in dependency order on a shared branch, then reviewed and tested in parallel. Brownfield support (existing codebases, new features, bug fixes) is next.

## The 11 Primitives Every Software Factory Needs

We tried to figure out the smallest set of building blocks that turns a ticket into a deployed app. Every factory needs these — the specific tools are up to you:

| # | Primitive | What It Does | This Factory Uses |
|---|---|---|---|
| 1 | **Record** | Where work gets tracked | Linear (project: "software factory") |
| 2 | **Memory** | How agents share context | `memory/` — one markdown file per ticket, append-only |
| 3 | **Orchestrator** | What decides who runs next | LangGraph state machine in `orchestrator/` |
| 4 | **Execution Env** | Where agents actually run | Docker container |
| 5 | **Agent Runtime** | The brain behind each agent | Claude Code via `claude-agent-sdk` |
| 6 | **Integration Layer** | How agents talk to external tools | 5 MCPs: Linear, GitHub, Vercel, Supabase, Slack |
| 7 | **Quality Gates** | Where humans stay in the loop | LangGraph `interrupt()` + Slack notifications |
| 8 | **Delivery Target** | Where the app gets deployed | Vercel (frontend) + Supabase (database via Vercel Marketplace) |
| 9 | **Observability** | How you see what's happening | Mission Control dashboard + LangSmith traces + Linear sub-issue tracking |
| 10 | **Skills** | What each agent knows how to do | `.claude/skills/` — 6 markdown files |
| 11 | **Identity & Secrets** | How agents authenticate | `.env` file mounted into Docker |

Swap any of these out. Use Jira instead of Linear. Deploy to Railway instead of Vercel. The primitives are the pattern. The tools are interchangeable.

## How It Works

```
Ticket created in Linear
        |
Webhook fires --> orchestrator/api.py (verifies Linear signature)
        |
Provision infra: GitHub repo + Vercel + Supabase + Next.js/Jest scaffold
        |   (blocks the ticket if the repo/scaffold didn't come up)
        |
Create 6 stage sub-issues in Linear (one per agent)
        |
PM Agent writes spec --> memory file
        |   🟢 Spec sub-issue checked off
        |
[GATE 1] 🟡 Waiting: "Move to In Arch to approve."
        |   🟢 Approved (or 🔴 Blocked)
        |
Architect Agent writes technical plan + subtasks
        |   🟢 Architecture sub-issue checked off
        |
[GATE 2] 🟡 Waiting: "Move to In Dev to approve."
        |   🟢 Approved (or 🔴 Blocked)
        |
Decompose: parse subtasks from architecture
        |
N × Dev Agents run in sequence (one per subtask, same branch — git-safe)
        |   🟢 Progress posted per subtask
        |
Single PR opened with all changes
        |   🟢 Implementation sub-issue checked off
        |
Review Agent + Test Agent run in parallel
        |   🟢 Code Review + Tests sub-issues checked off
        |
[GATE 3] 🟡 Waiting: "Move to In Deploy to approve."
        |   🟢 Approved (or 🔴 Blocked)
        |
Deploy Agent ships to Vercel + Supabase
        |   🟢 Deploy sub-issue checked off
        |
🟢 Done — final summary posted with repo link + deploy URL
```

Each agent is a Claude Code session running inside Docker. It reads the full memory file, follows its skill instructions, appends its output, and moves on. No agent-to-agent chatter. The memory file is the only shared state.

## Linear as a Dashboard

When a pipeline starts, the orchestrator:

1. Creates a new GitHub repo for the app
2. Creates 6 sub-issues under the parent ticket — one per agent stage
3. Posts a checklist comment on the parent ticket

As the pipeline runs, every event is posted to the Linear issue:

| Event | Comment |
|-------|---------|
| Pipeline start | ⚪ Pipeline started + stage checklist |
| Repo created | ⚪ Repository link |
| Agent starts | 🟡 "Spec — agent started" |
| Agent finishes | 🟢 "Spec — complete" + output excerpt |
| Gate waiting | 🟡 "Gate 1 — waiting for approval" |
| Gate approved | 🟢 "Gate 1 — approved" |
| Gate rejected | 🔴 "Gate 1 — rejected" |
| Subtask done | 🟢 "Subtask 2/5 done: Auth setup" |
| Error/timeout | 🔴 Error details + blocked reason |
| Pipeline done | 🟢 Final summary with repo + deploy URL |

Sub-issues are checked off as each agent completes. The parent issue becomes a complete record of the journey from idea to deployment.

## LangSmith Tracing

Every external call is traced as a nested span under the pipeline run:

- Linear GraphQL calls, sub-issue lifecycle
- Slack webhook posts
- Memory file reads and writes
- Each agent session, each parallel subtask
- Gate decisions, pipeline start/resume
- Webhook processing

## Try It

### What you need

- [Docker](https://docs.docker.com/get-docker/)
- [ngrok](https://ngrok.com/) (or any tunnel to expose port 8000)
- API keys for [Anthropic](https://console.anthropic.com/), [Linear](https://linear.app/), [GitHub](https://github.com/), [Vercel](https://vercel.com/), [Supabase](https://supabase.com/), [Slack](https://api.slack.com/)
- [LangSmith](https://smith.langchain.com/) (optional, for tracing)

### 1. Clone and add your keys

```bash
git clone https://github.com/ashtilawat/minimum-viable-factory.git
cd minimum-viable-factory
cp .env.example .env
```

Fill in `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
LINEAR_API_KEY=lin_api_...
LINEAR_WEBHOOK_SECRET=...
GITHUB_TOKEN=ghp_...
GITHUB_ORG=your-org-or-username
VERCEL_TOKEN=...
SUPABASE_TOKEN=...
SLACK_TOKEN=xoxb-...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
LANGCHAIN_API_KEY=lsv2_...          # optional
LANGCHAIN_PROJECT=your-project-name  # optional
LANGCHAIN_TRACING_V2=true            # optional
```

### 2. Set up Linear

Create these workflow states in your team settings (exact names matter):

```
Backlog --> In Spec --> In Arch --> In Dev --> In QA --> In Deploy --> Done --> Blocked
```

Create a project called **software factory** — all factory issues will live here.

Turn off all **Pull request automations** — the orchestrator handles state transitions.

### 3. Connect the webhook

```bash
ngrok http 8000
```

In Linear: **Settings > API > Webhooks > New webhook**
- URL: `https://your-ngrok-url.ngrok-free.app/webhook/linear`
- Resource types: Issues only

Copy the signing secret to `LINEAR_WEBHOOK_SECRET` in `.env`.

### 4. Set up Slack

Create an app at [api.slack.com/apps](https://api.slack.com/apps):
- Bot scopes: `chat:write`, `channels:read`
- Install to workspace, grab the bot token (`xoxb-...`) for `SLACK_TOKEN`
- Enable Incoming Webhooks, add one to your channel for `SLACK_WEBHOOK_URL`
- Invite the bot: `/invite @YourAppName`

### 5. Start the factory

```bash
docker compose build
docker compose up
```

Check it's up:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

Then open **Mission Control** at [http://localhost:8000](http://localhost:8000) — a
read-only live dashboard of every run (see [below](#mission-control-dashboard)).

### 6. Create a ticket and watch it run

Write a Linear ticket describing what you want built. Move it to **In Spec**.

The factory provisions the app's infrastructure — a GitHub repo scaffolded as a Next.js/TypeScript/Tailwind/Jest project, a linked Vercel project, and a Supabase database — then the PM Agent writes a spec. You get a Slack message at Gate 1. Move to **In Arch**. The Architect plans the implementation and breaks it into subtasks. Move to **In Dev**. Dev Agents build each subtask in sequence on one branch (git-safe) — progress is posted to the Linear issue. When all subtasks land, a single PR is opened. Review and test agents run on the combined PR in parallel. Move to **In Deploy**. The app deploys to Vercel (frontend) and Supabase (database, provisioned automatically via Vercel Marketplace). Done.

Every step is logged to the Linear issue. Open it to see the full journey.

### Run it locally (without Docker)

Docker is the recommended path (it bundles Node, the Claude Code CLI, and the MCP
servers). But you can also run the orchestrator directly for development:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Node 20+ is required for the agent sessions (claude-agent-sdk shells out to
# the Claude Code CLI) and the npx-based MCP servers:
npm install -g @anthropic-ai/claude-code

# API keys from your .env are read automatically (config.py calls load_dotenv):
uvicorn orchestrator:app --host 0.0.0.0 --port 8000 --reload
```

`WORKSPACE_DIR` defaults to `/app/workspace` (the container path). For local runs,
override it to a writable directory — e.g. `export WORKSPACE_DIR=./workspace` — or
just use Docker. Everything else (`memory/`, `audit/`, `.claude/skills/`) is read
relative to the working directory, so run from the repo root.

Point your Linear webhook at your tunnel (`ngrok http 8000`) exactly as above.

## Mission Control dashboard

Open [http://localhost:8000](http://localhost:8000) while the factory is running.
It's a **read-only** live ops console — a different lens than Linear's board, built
entirely from what the factory already writes to disk (`audit/*.log` +
`memory/*.md`), so it makes no external calls and can't affect a run.

- **Live feed** — the audit stream in real time (Server-Sent Events): agents
  starting/finishing, subtask fan-out, gates, blocks, deploys.
- **Action needed** — tickets currently waiting at a gate or blocked, each with the
  exact Linear state to move to. (Approvals still happen in Linear/Slack — the
  dashboard is read-only.)
- **Throughput** — shipped today, in-flight, blocked, average cycle time.
- **Fleet** — every ticket with its six-stage progress; click a row to open a drawer
  that renders the full memory file (spec → architecture → PR → review → tests →
  deploy).

Endpoints: `GET /` (page), `/api/state`, `/api/ticket/{id}`, `/api/events` (SSE).

## What's Inside

```
orchestrator/
  __init__.py                # Lazily exposes the FastAPI app
  config.py                  # Env vars, paths, timeouts
  state.py                   # LangGraph state schema + pipeline trigger states
  audit.py                   # Append-only audit logging
  memory.py                  # Memory file init + append-under-header (lock-guarded)
  linear.py                  # Linear GraphQL API + sub-issue lifecycle
  slack.py                   # Slack webhook posts
  agent_runner.py            # Core agent runner (claude-agent-sdk), per-agent timeout
  graph.py                   # LangGraph DAG construction
  pipeline.py                # Pipeline start/resume + infra provisioning/validation
  api.py                     # FastAPI endpoints (webhook signature verification)
  dashboard.py               # Read-only Mission Control (state/events from disk)
  static/
    dashboard.html           # Mission Control single-page UI
  nodes/
    __init__.py              # Re-exports all node functions
    agents.py                # PM, Architect, Review, Test, Deploy nodes
    dev.py                   # Decompose + sequential dev execution
    gates.py                 # Human approval gates (interrupt/resume)
    terminal.py              # Done and blocked handlers
tests/
  test_memory.py             # append_memory data-loss regression
  test_parse_subtasks.py     # architecture -> subtask parsing
  test_graph.py              # graph wiring + routing functions
  test_dashboard.py          # dashboard parsing / status / throughput
memory/
  _template.md               # Bootstrapped for each new ticket
  LIN-xxx.md                 # One file per ticket, append-only
.claude/
  CLAUDE.md                  # Master context for all agent sessions
  settings.json              # MCP server configuration
  skills/
    spec-writing/SKILL.md    # How to write a spec
    architecture/SKILL.md    # How to plan implementation
    coding/SKILL.md          # How to write code and open a PR
    code-review/SKILL.md     # How to review a PR
    test-writing/SKILL.md    # How to write and run tests
    deploy-checklist/SKILL.md # How to deploy and verify
audit/
  YYYY-MM-DD.log             # Every factory event, append-only
workspace/
  LIN-xxx/                   # Cloned app repo per ticket (gitignored)
Dockerfile
docker-compose.yml
```

## Tests

The orchestrator has a small offline test suite — it runs without any API keys or
external services (agent sessions fall back to stubs when `claude-agent-sdk` is
absent):

```bash
pip install -r requirements.txt pytest
pytest -q
```

Covered: the append-only memory (repeated writes to one section must all
persist), the architecture → subtask parser, the graph wiring / routing, and the
Mission Control dashboard (memory/audit parsing, gate + blocked detection,
throughput).

## License

MIT
