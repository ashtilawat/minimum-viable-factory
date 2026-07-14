"""Tests for the architecture -> subtask parser used by parallel dev."""

from orchestrator.nodes.dev import parse_subtasks

# Mirrors the format the architecture skill is told to emit.
ARCH_MEMORY = """# LIN-42 — Some ticket

## Architecture Decision
_2026-07-14T00:00:00+00:00_

### Approach
Do the thing.

### Subtasks
1. **Auth setup**: Add login route and session helper. Files: src/app/api/auth/route.ts, src/lib/session.ts
2. **Dashboard page**: Render the dashboard shell. Files: src/app/dashboard/page.tsx
3. **Wire data layer**: Add the fetch client. Files: src/lib/client.ts

## Implementation
_pending_
"""


def test_parses_all_subtasks():
    subs = parse_subtasks(ARCH_MEMORY)
    assert len(subs) == 3
    assert subs[0]["title"] == "Auth setup"
    assert subs[1]["title"] == "Dashboard page"
    assert subs[2]["title"] == "Wire data layer"
    assert "session helper" in subs[0]["description"]


def test_stops_at_next_top_level_section():
    subs = parse_subtasks(ARCH_MEMORY)
    # "Implementation" header must not bleed into the last subtask description
    assert "_pending_" not in subs[-1]["description"]
    assert "Implementation" not in subs[-1]["description"]


def test_no_subtasks_section_returns_empty():
    assert parse_subtasks("## Architecture Decision\n\n### Approach\nNo list here.\n") == []


def test_empty_input_returns_empty():
    assert parse_subtasks("") == []
