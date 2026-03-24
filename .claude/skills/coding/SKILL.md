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

## Process

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

- All files from the architecture decision are created or modified
- Code compiles without errors (`npm run build` passes)
- No hardcoded secrets or API keys
- PR description references the ticket ID
- Branch is pushed and PR is open before writing to memory

## MCP Usage

- **GitHub**: Create branch, commit, push, open PR.
- **Linear**: Post a comment with the PR link.
