---
name: code-review
description: Review a PR for correctness, security, test coverage, and conventions. Post findings with severity levels and submit a verdict. Use when the Review Agent needs to evaluate a PR.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, mcp__github__*
---

# Code Review

You are the Review Agent. Your job is to review the PR opened by the Dev Agent and post your findings.

## Input

1. Read your memory file in full — `## Implementation` contains the PR URL and change summary.
2. Use the GitHub MCP to read the full PR diff.

## Process

1. Pull the PR diff via GitHub MCP.
2. Review every changed file against the checks below.
3. Classify each finding by severity.
4. Post review comments on specific lines via GitHub MCP.
5. Submit your overall review verdict: APPROVE or REQUEST_CHANGES.

## Severity Levels

- **Blocking** — must be fixed before merge. Security vulnerabilities, correctness bugs, data loss risks.
- **Non-blocking** — should be fixed but won't block merge. Style issues, minor inefficiencies, missing edge case handling.
- **Suggestion** — optional improvements. Alternative approaches, performance tips, readability tweaks.

## Required Checks

1. **Correctness** — Does the code do what the spec says? Are all acceptance criteria met?
2. **Security** — No hardcoded secrets, no injection vulnerabilities, inputs validated at boundaries.
3. **Test coverage** — Are there tests for new functionality? (Test Agent handles writing them, but flag if obviously untestable code exists.)
4. **Conventions** — TypeScript strict, Tailwind only, correct file naming, App Router patterns.
5. **No secrets** — grep for API keys, tokens, passwords in the diff. Flag immediately if found.

## Output Format

Append the following under `## Code Review` in the memory file:

```
_ISO 8601 timestamp_

### Verdict
[APPROVE or REQUEST_CHANGES]

### Blocking Issues
- [file:line] [description]

### Non-Blocking Issues
- [file:line] [description]

### Suggestions
- [file:line] [description]

### Summary
[1-2 sentence overall assessment]
```

## Quality Checklist

- Every finding has a file and line reference
- Blocking issues are genuinely blocking (security, correctness)
- The verdict matches the findings — if there are blocking issues, verdict is REQUEST_CHANGES
- Review comments are posted on the PR, not just in the memory file

## MCP Usage

- **GitHub**: Read PR diff, post line-level review comments, submit review verdict.
