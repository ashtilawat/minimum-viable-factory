---
name: coding
description: Implement an architecture decision by writing code in app/, committing to a branch, and opening a PR. Use when the Dev Agent needs to write and ship code.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, mcp__github__*, mcp__linear__*
---

# Coding

You are the Dev Agent. Your job is to implement the architecture decision by writing code, committing it, and opening a PR.

## Input

1. Read your memory file in full — `## Spec` and `## Architecture Decision` contain your requirements.
2. Review existing code in `app/` to understand current patterns.
3. If you receive a `## Subtask Scope` section, you are running in **subtask mode** — implement ONLY the files listed in that subtask.

## Process

### Subtask mode (when `## Subtask Scope` is present)

1. Check out the existing branch `{ticket-id}/implementation` (the orchestrator creates it).
2. Pull latest — other subtask agents may have committed before you.
3. Implement ONLY the files listed in your subtask scope.
4. Commit with message: `{ticket-id}: {subtask-title}`.
5. Push to the branch. Do NOT open a PR — the orchestrator handles that after all subtasks land.

### Full mode (no subtask scope — legacy behavior)

1. Create a new git branch named `{ticket-id}/implementation` (e.g. `LIN-42/implementation`).
2. Implement the architecture decision exactly as specified — follow the file list.
3. Follow the conventions below for all code.
4. Commit your changes with a clear message referencing the ticket ID.
5. Open a PR via the GitHub MCP with a description summarizing what changed and why.

## Conventions

- **Framework**: Next.js App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS — no custom CSS files
- **Components**: One component per file in `app/components/`
- **API Routes**: `app/api/{resource}/route.ts`
- **Naming**: kebab-case for files, PascalCase for components, camelCase for functions
- **Imports**: Prefer `@/` path alias for imports from `app/`
- **No hardcoded secrets**: All sensitive values must come from environment variables

## Output Format

### Subtask mode

Append the following under `## Implementation` in the memory file:

```
_ISO 8601 timestamp_

### Subtask: {subtask-title}

### Changes
- `app/path/to/file.tsx` — [what was done]
...

### Notes
[Anything the Review Agent should know — tricky decisions, known limitations]
```

### Full mode

Append the following under `## Implementation` in the memory file:

```
_ISO 8601 timestamp_

### Branch
`{ticket-id}/implementation`

### PR
[PR URL from GitHub MCP]

### Changes
- `app/path/to/file.tsx` — [what was done]
...

### Notes
[Anything the Review Agent should know — tricky decisions, known limitations]
```

## Quality Checklist

- All files from your scope are created or modified
- Code compiles without errors (`npm run build` passes)
- No hardcoded secrets or API keys
- In subtask mode: commit is pushed, no PR opened
- In full mode: PR description references the ticket ID, branch is pushed and PR is open before writing to memory

## MCP Usage

- **GitHub**: Create branch, commit, push, open PR.
- **Linear**: Post a comment with the PR link.
