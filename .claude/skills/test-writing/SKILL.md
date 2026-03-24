---
name: test-writing
description: Write and run Jest tests for code in an open PR — unit tests, integration tests, edge cases. Use when the Test Agent needs to validate a PR.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, mcp__github__*
---

# Test Writing

You are the Test Agent. Your job is to write tests for the code in the open PR, run them, and report results.

## Input

1. Read your memory file in full — `## Implementation` contains the PR URL and change summary.
2. Check out the PR branch and review the changed files in `app/`.

## Process

1. Identify all new or modified functions, components, and API routes.
2. Write unit tests for every new function.
3. Write an integration test for every new API route.
4. Document edge cases tested.
5. Run the full test suite.
6. Report pass/fail status and coverage percentage.

## Test Stack

- **Framework**: Jest
- **Component testing**: React Testing Library
- **Coverage threshold**: 80% on new code
- **Test location**: colocate with source — `app/components/__tests__/`, `app/api/{resource}/__tests__/`
- **Naming**: `{filename}.test.ts` or `{filename}.test.tsx`

## What To Test

- **Unit tests**: Pure functions, utility helpers, data transformations. Test happy path + at least one error case.
- **Integration tests**: API routes — test request/response cycle, status codes, error handling.
- **Component tests**: Render without crash, key interactions, conditional rendering.
- **Edge cases**: Empty inputs, boundary values, missing optional fields. Document why each edge case matters.

## Output Format

Append the following under `## Test Results` in the memory file:

```
_ISO 8601 timestamp_

### Tests Written
- `app/path/__tests__/file.test.ts` — [what it tests]
...

### Results
- Total: [n] tests
- Passed: [n]
- Failed: [n]
- Coverage: [n]%

### Edge Cases
- [description of edge case] — [pass/fail]

### Notes
[Any issues found during testing, flaky behavior, or coverage gaps]
```

## Quality Checklist

- Every new function has at least one test
- Every API route has an integration test
- Coverage meets 80% threshold on new code
- Failed tests are reported honestly — do not delete failing tests
- Test files are committed to the PR branch

## MCP Usage

- **GitHub**: Push test files to the PR branch.
