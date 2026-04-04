# Minimum Viable Factory

Ticket in, deployed web app out. The full SDLC — spec, architecture, code, review, tests, deploy — handled by coding agents running in parallel. You approve at three gates.

**~700 lines of Python across 16 modules. 6 skills. 5 MCPs. You can read every file in one sitting.**

Right now this factory greenfields web apps from idea to production. You describe what you want, agents build and deploy it from scratch. Each app gets its own GitHub repo. Large tasks are automatically decomposed into subtasks and built in parallel. Brownfield support (existing codebases, new features, bug fixes) is next.

## The 11 Primitives Every Software Factory Needs

We tried to figure out the smallest set of building blocks that turns a ticket into a deployed app. Every factory needs these — the specific tools are up to you:

| # | Primitive | What It Does | This Factory Uses |
|---|---|---|---|
| 1 | **Record** | Where work gets tracked | Linear (project: "software factory") |
| 2 | **Memory** | How agents share context | `memory/` — one markdown file per ticket, append-only |
| 3 | **Orchestrator** | What decides who runs next | LangGraph state machine in `orchestrator/` |
| 4 | **Execution Env** | Where agents actually run | Docker container |
| 5 | **Agent Runtime** | The brain behind each agent | Claude SDK, Codex CLI, or Cursor Agent CLI via `orchestrator/runtime.py` |
| 6 | **Integration Layer** | How agents talk to external tools | 5 MCPs: Linear, GitHub, Vercel, Supabase, Slack |
| 7 | **Quality Gates** | Where humans stay in the loop | LangGraph `interrupt()` + Slack notifications |
| 8 | **Delivery Target** | Where the app gets deployed | Vercel (frontend) + Supabase (database via Vercel Marketplace) |
| 9 | **Observability** | How you see what's happening | LangSmith traces + Linear sub-issue tracking |
| 10 | **Skills** | What each agent knows how to do | `.claude/skills/` — 6 markdown files |
| 11 | **Identity & Secrets** | How agents authenticate | `.env` file mounted into Docker |

Swap any of these out. Use Jira instead of Linear. Deploy to Railway instead of Vercel. The primitives are the pattern. The tools are interchangeable.

## How It Works

```
Ticket created in Linear
        |
Webhook fires --> orchestrator/api.py
        |
Create GitHub repo for the app
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
N × Dev Agents run in parallel (one per subtask, same branch)
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

Each agent session reads the full memory file, follows its skill instructions, appends its output, and moves on. No agent-to-agent chatter. The memory file is the only shared state.

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

- Python 3.12+
- [ngrok](https://ngrok.com/) (or any tunnel to expose port 8000)
- [Codex CLI](https://developers.openai.com/codex/cli/) logged in with your ChatGPT/Codex subscription **or** [Cursor Agent CLI](https://cursor.com/cli) with `CURSOR_API_KEY` (or `agent login` — see below)
- API keys for [Linear](https://linear.app/), [GitHub](https://github.com/), [Vercel](https://vercel.com/), [Supabase](https://supabase.com/), [Slack](https://api.slack.com/)
- [LangSmith](https://smith.langchain.com/) (optional, for tracing)

### 1. Clone and add your keys

```bash
git clone https://github.com/ashtilawat/minimum-viable-factory.git
cd minimum-viable-factory
```

Fill in `.env`:

```
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
AGENT_RUNTIME=codex
WORKSPACE_DIR=workspace
CODEX_MODEL=gpt-5.4-mini             # optional; override e.g. gpt-5.4 for heavier runs
CODEX_STREAM_OUTPUT=true             # optional; stream codex stdout/stderr to logs (default on; set false for quiet CI)

# Cursor Agent CLI (Composer 2 and other models)
# AGENT_RUNTIME=cursor
# CURSOR_BIN=agent                   # optional; default agent (also try cursor-agent if on PATH)
# CURSOR_MODEL=composer-2            # optional; use composer-2-fast for default fast tier; run: agent --list-models
# CURSOR_STREAM_OUTPUT=true          # optional; stream agent stdout/stderr (default on; same false/0/no/off as Codex)
# CURSOR_API_KEY=...                 # recommended for headless/CI; from Cursor Dashboard API keys
```

For local subscription-based runs, log in once before starting the orchestrator:

```bash
codex login
codex login status
```

The Codex backend translates the existing MCP definitions from `.claude/settings.json` into per-run Codex config overrides, so you do not need a separate `.codex/config.toml` just to reuse the Linear, GitHub, Vercel, Supabase, and Slack servers.

While `codex exec` runs, the orchestrator logs each stdout/stderr line at INFO with `[codex:stdout]` / `[codex:stderr]` prefixes, plus start/finish lines with profile and return code. Set `CODEX_STREAM_OUTPUT=false` (or `0` / `no` / `off`) to buffer output silently until the process exits, like the previous behavior.

### Cursor Agent CLI (`AGENT_RUNTIME=cursor`)

Install the CLI ([Cursor CLI](https://cursor.com/cli)):

```bash
curl https://cursor.com/install -fsS | bash
```

Ensure `agent` is on your `PATH` (often `~/.local/bin`). **Local auth:** `agent login` works because the subprocess keeps your real `HOME` (macOS keychain-backed sessions). For servers or CI without a login, set `CURSOR_API_KEY` in `.env` (see [Cursor docs](https://cursor.com/docs/cli/overview)).

With `AGENT_RUNTIME=cursor`, the orchestrator runs `agent --print --force --trust --approve-mcps --sandbox disabled` against the ticket workspace, default model **`composer-2`** (override with `CURSOR_MODEL`; use `auto` for the CLI’s auto model). For profiles that use MCP, servers from `.claude/settings.json` are written to **`<workspace>/.cursor/mcp.json`** for the duration of the run (previous file content is restored afterward; concurrent runs on the same workspace are serialized). Env vars are resolved the same way as Codex.

Log lines use `[cursor:stdout]` / `[cursor:stderr]` when `CURSOR_STREAM_OUTPUT` is on (default).

**Runtime profiles:** Claude uses fine-grained allowed tools per profile (`general`, `infra`, `git_only`, `pr`). The Cursor path uses the same MCP *subset* per profile but does not map 1:1 to Claude’s tool allowlist; permissions are coarser (`--force`, sandbox disabled).

**Linear context:** Like Codex, the orchestrator still injects ticket title, description, and recent comments into the prompt so agents can proceed if a connector misbehaves.

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

Local-first Codex runtime:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn orchestrator:app --host 0.0.0.0 --port 8000
```

Docker remains the easiest path for the Claude runtime. The image also installs the [Codex CLI](https://developers.openai.com/codex/cli/) (`@openai/codex`) and the [Cursor Agent CLI](https://cursor.com/cli/) (install script → `~/.local/bin/agent`). Codex auth from your host is bind-mounted (`${HOME}/.codex` → `/home/factory/.codex`). Cursor auth can use `CURSOR_API_KEY` in `.env` and/or mount `${HOME}/.cursor` → `/home/factory/.cursor` (already in `docker-compose.yml`) for file-based login state from `agent login` on the host.

Claude runtime in Docker:

```bash
docker compose build
docker compose up
```

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

Codex runtime in Docker:

1. On the **host**, log in once (same as local-first): `codex login` and `codex login status`.
2. Set `AGENT_RUNTIME=codex` in `.env` (plus your usual `CODEX_MODEL` / `CODEX_STREAM_OUTPUT` if desired).
3. Run `docker compose build` and `docker compose up`. Compose mounts your host `~/.codex` so `codex exec` inside the container can use the same credentials; `CODEX_HOME` is set to `/home/factory/.codex`.
4. Verify with `curl http://localhost:8000/health`.

**Credential mode:** Codex can store auth in a file under `~/.codex` or in the OS keyring. The container cannot use your host keyring. If `~/.codex` is empty or auth fails, configure [Codex authentication](https://developers.openai.com/codex/auth) so credentials exist as files under `CODEX_HOME` (e.g. `auth.json`), or ensure the mounted directory contains valid auth after logging in on the host.

**Troubleshooting:** If `codex exec` fails with auth errors, confirm `${HOME}` is set when you run `docker compose` (so the bind mount resolves), inspect `~/.codex` on the host, and on Linux use matching `user:` / UID in Compose if you see permission denied on the mount.

Cursor runtime in Docker:

1. Set `AGENT_RUNTIME=cursor` and `CURSOR_API_KEY` in `.env` (recommended), or log in on the host with `agent login` so `~/.cursor` contains auth and the Compose mount provides it in-container.
2. Run `docker compose build` and `docker compose up`. The image installs `agent` to `/home/factory/.local/bin` (`PATH` is set in the Dockerfile).
3. Optional: override `CURSOR_MODEL` (e.g. `composer-2-fast`) and `CURSOR_STREAM_OUTPUT` the same way as locally.

If `agent` fails with auth errors, verify `CURSOR_API_KEY` is set for the container or that the `~/.cursor` mount is populated after a successful host `agent login`.

### 6. Create a ticket and watch it run

Write a Linear ticket describing what you want built. Move it to **In Spec**.

The factory creates a GitHub repo, then the PM Agent writes a spec. You get a Slack message at Gate 1. Move to **In Arch**. The Architect plans the implementation and breaks it into subtasks. Move to **In Dev**. Parallel Dev Agents build each subtask — progress is posted to the Linear issue. When all subtasks land, a single PR is opened. Review and test agents run on the combined PR. Move to **In Deploy**. The app deploys to Vercel (frontend) and Supabase (database, provisioned automatically via Vercel Marketplace). Done.

Every step is logged to the Linear issue. Open it to see the full journey.

## What's Inside

```
orchestrator/
  __init__.py                # Exports FastAPI app
  config.py                  # Env vars, paths, constants
  runtime.py                 # Claude / Codex / Cursor runtime adapter
  state.py                   # LangGraph state schema + Linear state map
  audit.py                   # Append-only audit logging
  memory.py                  # Memory file init and append
  linear.py                  # Linear GraphQL API + sub-issue lifecycle
  slack.py                   # Slack webhook posts
  agent_runner.py            # Core agent runner (memory + Linear orchestration)
  graph.py                   # LangGraph DAG construction
  pipeline.py                # Pipeline start/resume + repo creation
  api.py                     # FastAPI endpoints
  nodes/
    __init__.py              # Re-exports all node functions
    agents.py                # PM, Architect, Review, Test, Deploy nodes
    dev.py                   # Decompose + parallel dev execution
    gates.py                 # Human approval gates (interrupt/resume)
    terminal.py              # Done and blocked handlers
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

## License

MIT
