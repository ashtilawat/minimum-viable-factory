# Minimum Viable Factory

Most AI agent demos show you a single agent doing a single task. This is a full factory — six agents, three human gates, one orchestrator, zero complexity you can't read in a sitting.

You create a Linear ticket. A PM agent writes the spec. An architect plans the implementation. A dev agent writes the code and opens a PR. Review and test agents run in parallel. A deploy agent ships it to Railway. You approve at three gates via Slack. That's it.

**~480 lines of orchestrator. 6 skills. 4 MCPs. The factory is simpler than what it builds.**

## Why Try This

- **It actually runs.** This isn't a diagram or a whitepaper. Clone it, add your keys, create a ticket, and watch agents build a web app.
- **You can read the whole thing.** The orchestrator is one file. Each skill is one page of markdown. There are no abstractions to chase.
- **Human-in-the-loop by default.** Three gates where the pipeline pauses and waits for you. You stay in control without doing the work.
- **Agents share memory, not messages.** Every agent reads and writes to one append-only markdown file per ticket. No agent-to-agent chatter. The memory file is the source of truth.
- **It's a starting point.** Swap Railway for Vercel. Swap Linear for Jira. Swap the skills for your conventions. The pattern is the point.

## How It Works

```
Linear ticket created
        |
Webhook fires --> orchestrator.py
        |
PM Agent writes spec --> memory/LIN-xxx.md
        |
[GATE 1] Slack notification --> human approves
        |
Architect Agent writes technical plan
        |
[GATE 2] Slack notification --> human approves
        |
Dev Agent writes code --> opens PR
        |
Review Agent + Test Agent run in parallel
        |
[GATE 3] Slack notification --> human approves
        |
Deploy Agent ships to Railway
        |
Done
```

Each agent is a Claude Code session (via `claude-agent-sdk`) running inside Docker. The orchestrator is a LangGraph state machine that routes Linear webhooks to agents and pauses at gates.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [ngrok](https://ngrok.com/) (or any tunnel to expose localhost)
- Accounts and API keys for: [Anthropic](https://console.anthropic.com/), [Linear](https://linear.app/), [GitHub](https://github.com/), [Railway](https://railway.app/), [Slack](https://api.slack.com/), [LangSmith](https://smith.langchain.com/) (optional)

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/ashtilawat/minimum-viable-factory.git
cd minimum-viable-factory
cp .env.example .env
```

Edit `.env` and fill in your keys:

```
ANTHROPIC_API_KEY=sk-ant-...
LINEAR_API_KEY=lin_api_...
LINEAR_WEBHOOK_SECRET=...
GITHUB_TOKEN=ghp_...
RAILWAY_TOKEN=railway_...
SLACK_TOKEN=xoxb-...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
LANGCHAIN_API_KEY=lsv2_...          # optional, for tracing
LANGCHAIN_PROJECT=your-project-name  # optional
LANGCHAIN_TRACING_V2=true            # optional
```

### 2. Set up Linear workflow states

In your Linear team settings, go to **Workflow** and create these states exactly as named:

```
Backlog --> In Spec --> In Arch --> In Dev --> In QA --> In Deploy --> Done --> Blocked
```

Disable all **Pull request automations** (set every dropdown to "No action") — the orchestrator manages state transitions.

### 3. Set up Linear webhook

Start your tunnel:

```bash
ngrok http 8000
```

In Linear, go to **Settings > API > Webhooks > New webhook**:
- **URL**: `https://your-ngrok-url.ngrok-free.app/webhook/linear`
- **Resource types**: Issues only

Copy the signing secret into your `.env` as `LINEAR_WEBHOOK_SECRET`.

### 4. Set up Slack

Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps):
- Add bot scopes: `chat:write`, `channels:read`
- Install to workspace, copy the **Bot User OAuth Token** (`xoxb-...`) as `SLACK_TOKEN`
- Enable **Incoming Webhooks**, add one to your channel, copy URL as `SLACK_WEBHOOK_URL`
- Invite the bot to the channel: `/invite @YourAppName`

### 5. Build and run

```bash
docker compose build
docker compose up
```

Verify:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### 6. Create a ticket

Create a Linear ticket with a description of what you want built. Move it to **In Spec**. Watch the factory run:

- PM Agent writes a spec and posts to Slack at Gate 1
- Move to **In Arch** to approve and trigger the Architect Agent
- Move to **In Dev** to approve and trigger the Dev Agent
- Review + Test agents run automatically in parallel
- Move to **In Deploy** to approve and trigger the Deploy Agent
- Ticket moves to **Done**

## Architecture

### The Eleven Primitives

| Primitive | Tool |
|---|---|
| Record | Linear |
| Memory | `memory/` — append-only markdown, one file per ticket |
| Orchestrator | LangGraph + FastAPI in `orchestrator.py` |
| Execution Env | Docker |
| Agent Runtime | Claude Code (via claude-agent-sdk) |
| Integration Layer | 4 MCPs: Linear, GitHub, Railway, Slack |
| Quality Gates | LangGraph interrupts |
| Delivery Target | Railway |
| Observability | Railway logs + LangSmith traces |
| Skills | `.claude/skills/` — 6 markdown skill files |
| Identity & Secrets | `.env` |

### Agent Roster

| Agent | Triggered By | Skill | Output |
|---|---|---|---|
| PM Agent | `In Spec` | spec-writing | Problem statement, acceptance criteria |
| Architect Agent | `In Arch` | architecture | Technical plan, files affected |
| Dev Agent | `In Dev` | coding | Code in `app/`, opens PR |
| Review Agent | `In QA` | code-review | PR review with severity levels |
| Test Agent | `In QA` | test-writing | Jest tests, coverage report |
| Deploy Agent | `In Deploy` | deploy-checklist | Railway deploy, health check |

Review and Test agents run in parallel on the same PR.

### Memory

Every ticket gets a file at `memory/LIN-xxx.md`. Agents append output under their section header. The file is append-only — history is never overwritten. Each agent reads the full file to understand what happened before it.

### Gates

Gates are LangGraph `interrupt()` calls. The pipeline pauses, Slack gets a notification, and the orchestrator waits for the human to move the ticket to the next state in Linear. The webhook resumes the graph from the checkpoint stored in SQLite.

## Project Structure

```
orchestrator.py              # FastAPI + LangGraph state machine (~480 lines)
memory/
  _template.md               # Bootstrapped for each new ticket
  LIN-xxx.md                 # One file per ticket, append-only
.claude/
  CLAUDE.md                  # Master context for all agent sessions
  settings.json              # MCP server configuration
  skills/
    spec-writing/SKILL.md
    architecture/SKILL.md
    coding/SKILL.md
    code-review/SKILL.md
    test-writing/SKILL.md
    deploy-checklist/SKILL.md
audit/
  YYYY-MM-DD.log             # Every factory event
app/                         # The web app being built
Dockerfile
docker-compose.yml
requirements.txt
.env.example
```

## License

MIT
