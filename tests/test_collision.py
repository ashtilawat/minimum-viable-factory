"""Tests for same-wave scope and branch collision detection."""

from orchestrator.collision import find_collisions


def test_no_collisions_for_disjoint_same_wave_tickets():
    tickets = [
        {"id": "A", "scope": ["src/a.py"], "branch": "feat/a", "wave": 1},
        {"id": "B", "scope": ["src/b.py"], "branch": "feat/b", "wave": 1},
    ]
    assert find_collisions(tickets) == []


def test_same_wave_scope_file_overlap_is_collision():
    tickets = [
        {"id": "A", "scope": ["orchestrator/collision.py"], "branch": "feat/a", "wave": 1},
        {"id": "B", "scope": ["orchestrator/collision.py"], "branch": "feat/b", "wave": 1},
    ]
    result = find_collisions(tickets)
    assert len(result) == 1
    assert result[0]["reason"] == "scope_overlap"
    assert set(result[0]["tickets"]) == {"A", "B"}


def test_same_wave_directory_prefix_overlap_is_collision():
    tickets = [
        {"id": "A", "scope": ["orchestrator/"], "branch": "feat/a", "wave": 1},
        {"id": "B", "scope": ["orchestrator/collision.py"], "branch": "feat/b", "wave": 1},
    ]
    result = find_collisions(tickets)
    assert any(c["reason"] == "scope_overlap" for c in result)


def test_same_wave_sibling_paths_do_not_overlap():
    tickets = [
        {"id": "A", "scope": ["src/foo.py"], "branch": "feat/a", "wave": 1},
        {"id": "B", "scope": ["src/bar.py"], "branch": "feat/b", "wave": 1},
    ]
    assert find_collisions(tickets) == []


def test_same_wave_same_branch_is_collision():
    tickets = [
        {"id": "A", "scope": ["src/a.py"], "branch": "feat/shared", "wave": 2},
        {"id": "B", "scope": ["src/b.py"], "branch": "feat/shared", "wave": 2},
    ]
    result = find_collisions(tickets)
    assert len(result) == 1
    assert result[0]["reason"] == "same_branch"


def test_same_wave_same_branch_and_scope_overlap_reports_one_collision():
    tickets = [
        {"id": "A", "scope": ["lib/x.py"], "branch": "feat/x", "wave": 1},
        {"id": "B", "scope": ["lib/x.py"], "branch": "feat/x", "wave": 1},
    ]
    result = find_collisions(tickets)
    assert len(result) == 1
    assert set(result[0]["tickets"]) == {"A", "B"}


def test_different_waves_may_overlap_scope_and_branch():
    tickets = [
        {"id": "A", "scope": ["shared/path.py"], "branch": "main", "wave": 1},
        {"id": "B", "scope": ["shared/path.py"], "branch": "main", "wave": 2},
    ]
    assert find_collisions(tickets) == []


def test_empty_scope_is_collision():
    tickets = [{"id": "A", "scope": [], "branch": "feat/a", "wave": 1}]
    result = find_collisions(tickets)
    assert len(result) == 1
    assert result[0]["reason"] == "empty_scope_or_branch"
    assert result[0]["tickets"] == ["A", "A"]


def test_empty_branch_is_collision():
    tickets = [{"id": "B", "scope": ["src/b.py"], "branch": "", "wave": 1}]
    result = find_collisions(tickets)
    assert len(result) == 1
    assert result[0]["reason"] == "empty_scope_or_branch"


def test_whitespace_only_branch_is_collision():
    tickets = [{"id": "C", "scope": ["src/c.py"], "branch": "   ", "wave": 1}]
    result = find_collisions(tickets)
    assert len(result) == 1
    assert result[0]["reason"] == "empty_scope_or_branch"


def test_empty_input_is_safe():
    assert find_collisions([]) == []
