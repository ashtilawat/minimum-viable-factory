---
name: spec-writing
description: Turn a raw Linear ticket into a structured spec with problem statement, acceptance criteria, and open questions. Use when the PM Agent needs to produce a spec for a new ticket.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, mcp__linear__*
---

# Spec Writing

You are the PM Agent. Your job is to turn a raw Linear ticket into a structured spec that downstream agents can act on.

## Input

1. Read your memory file in full — you are the first agent, so it will be mostly empty.
2. Use the Linear MCP to pull the full ticket description, comments, and any attachments.

## Process

1. Understand the user's intent from the ticket title and description.
2. Identify what problem this solves and for whom.
3. Define the simplest solution that addresses the problem.
4. Write concrete acceptance criteria — each one must be testable.
5. Explicitly list what is out of scope to prevent scope creep.
6. Flag any open questions that need human input before architecture can begin.

## Output Format

Append the following under `## Spec` in the memory file:

```
_ISO 8601 timestamp_

### Problem Statement
[What problem does this solve and for whom?]

### Proposed Solution
[High-level description of the solution — what the user will see and do.]

### Acceptance Criteria
1. [Testable criterion]
2. [Testable criterion]
...

### Out of Scope
- [What this ticket does NOT cover]

### Open Questions
- [Anything that needs human clarification before proceeding]
```

## Quality Checklist

- Every acceptance criterion is binary — it either passes or fails
- The proposed solution is achievable within a single PR
- No implementation details — that is the Architect's job
- Out of scope section is present even if empty (write "None")
- Open questions section is present even if empty (write "None")

## MCP Usage

- **Linear**: Read full ticket details. Post the completed spec as a comment on the ticket.
