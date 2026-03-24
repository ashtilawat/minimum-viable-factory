# Minimum Viable Factory

Ticket in, deployed web app out. The full SDLC — spec, architecture, code, review, tests, deploy — handled by six Claude Code agents. You approve at three gates. One orchestrator file runs the whole thing.

**~500 lines of Python. 6 skills. 4 MCPs. You can read every file in one sitting.**

Right now this factory greenfields web apps from idea to production. You describe what you want, agents build and deploy it from scratch. Brownfield support (existing codebases, new features, bug fixes) is next.

## The 11 Primitives Every Software Factory Needs

We tried to figure out the smallest set of building blocks that turns a ticket into a deployed app. Every factory needs these — the specific tools are up to you:

| # | Primitive | What It Does | This Factory Uses |
|---|---|---|---|
| 1 | **Record** | Where work gets tracked | Linear |
| 2 | **Memory** | How agents share context | `memory/` — one markdown file per ticket, append-only |
| 3 | **Orchestrator** | What decides who runs next | LangGraph state machine in `orchestrator.py` |
| 4 | **Execution Env** | Where agents actually run | Docker container |
| 5 | **Agent Runtime** | The brain behind each agent | Claude Code via `claude-agent-sdk` |
| 6 | **Integration Layer** | How agents talk to external tools | 4 MCPs: Linear, GitHub, Railway, Slack |
| 7 | **Quality Gates** | Where humans stay in the loop | LangGraph `interrupt()` + Slack notifications |
| 8 | **Delivery Target** | Where the app gets deployed | Railway |
| 9 | **Observability** | How you see what's happening | LangSmith traces + Railway logs |
| 10 | **Skills** | What each agent knows how to do | `.claude/skills/` — 6 markdown files |
| 11 | **Identity & Secrets** | How agents authenticate | `.env` file mounted into Docker |

Swap any of these out. Use Jira instead of Linear. Deploy to Vercel instead of Railway. The primitives are the pattern. The tools are interchangeable.

## How It Works

```
Ticket created (Linear in this implementation)
        |
Webhook fires --> orchestrator.py
        |
PM Agent writes spec --> memory file
        |
[GATE 1] Slack: "Spec ready. Move to In Arch to approve."
        |
Architect Agent writes technical plan
        |
[GATE 2] Slack: "Architecture ready. Move to In Dev to approve."
        |
Dev Agent writes code, opens PR
        |
Review Agent + Test Agent run in parallel
        |
[GATE 3] Slack: "QA passed. Move to In Deploy to approve."
        |
Deploy Agent ships to Railway
        |
Done
```

Each agent is a Claude Code session running inside Docker. It reads the full memory file, follows its skill instructions, appends its output, and moves on. No agent-to-agent chatter. The memory file is the only shared state.

## Try It

### What you need

- [Docker](https://docs.docker.com/get-docker/)
- [ngrok](https://ngrok.com/) (or any tunnel to expose port 8000)
- API keys for [Anthropic](https://console.anthropic.com/), [Linear](https://linear.app/), [GitHub](https://github.com/), [Railway](https://railway.app/), [Slack](https://api.slack.com/)
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
RAILWAY_TOKEN=railway_...
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

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### 6. Create a ticket and watch it run

Write a Linear ticket describing what you want built. Move it to **In Spec**.

The PM Agent writes a spec. You get a Slack message. Move to **In Arch**. The Architect plans the implementation. Move to **In Dev**. The Dev Agent writes code and opens a PR. Review and test run automatically. Move to **In Deploy**. Done.

## What's Inside

```
orchestrator.py              # The whole state machine (~500 lines)
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
app/                         # Where the web app gets built
Dockerfile
docker-compose.yml
```

## License

MIT
