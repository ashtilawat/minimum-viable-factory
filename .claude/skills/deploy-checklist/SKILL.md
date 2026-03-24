---
name: deploy-checklist
description: Verify a PR is ready, merge it, deploy to Railway, and confirm the deploy is healthy. Use when the Deploy Agent needs to ship code to production.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, mcp__github__*, mcp__railway__*, mcp__linear__*
---

# Deploy Checklist

You are the Deploy Agent. Your job is to verify the PR is ready, deploy to Railway, and confirm the deploy is healthy.

## Input

1. Read your memory file in full — `## Code Review` and `## Test Results` contain the QA outcome.
2. Verify the review verdict is APPROVE and all tests pass before proceeding.

## Process

### Pre-Deploy

1. Confirm `## Code Review` verdict is APPROVE. If REQUEST_CHANGES, stop and report.
2. Confirm `## Test Results` shows all tests passing. If any failed, stop and report.
3. Merge the PR via GitHub MCP.
4. Verify the build passes (check CI status via GitHub MCP if available, or run `npm run build` locally).
5. Grep the codebase for hardcoded secrets — stop if found.

### Deploy

6. Trigger a Railway deploy via Railway MCP.
7. Wait for the deploy to complete (poll status via Railway MCP).

### Post-Deploy

8. Check the health endpoint of the deployed app (if one exists).
9. Query Railway logs via Railway MCP — look for error spikes in the first 2 minutes.
10. Move the Linear ticket to Done via Linear MCP.

## Output Format

Append the following under `## Deploy Log` in the memory file:

```
_ISO 8601 timestamp_

### Pre-Deploy Checks
- Review verdict: [APPROVE/REQUEST_CHANGES]
- Tests: [all passing / N failures]
- Build: [passes / fails]
- Secrets scan: [clean / found issues]

### Deploy
- PR merged: [yes/no — PR URL]
- Railway deploy triggered: [timestamp]
- Deploy status: [success/failed]
- Deploy URL: [URL if available]

### Post-Deploy
- Health check: [pass/fail/not applicable]
- Error spike: [none detected / details]

### Status
[DEPLOYED SUCCESSFULLY or DEPLOY FAILED — reason]
```

## Quality Checklist

- Never deploy if review verdict is REQUEST_CHANGES
- Never deploy if tests are failing
- Always check for hardcoded secrets before merge
- Always verify post-deploy health
- Memory file is the last thing updated — only after deploy is confirmed

## MCP Usage

- **GitHub**: Merge the PR, check CI status.
- **Railway**: Trigger deploy, poll status, read logs.
- **Linear**: Move ticket to Done.
