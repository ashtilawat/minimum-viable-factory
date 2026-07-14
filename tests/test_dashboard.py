"""Tests for the read-only Mission Control dashboard data layer."""

from datetime import datetime, timezone

import pytest

from orchestrator import dashboard as dash


@pytest.fixture
def factory_dirs(tmp_path, monkeypatch):
    mem = tmp_path / "memory"
    aud = tmp_path / "audit"
    mem.mkdir()
    aud.mkdir()
    monkeypatch.setattr(dash, "MEMORY_DIR", mem)
    monkeypatch.setattr(dash, "AUDIT_DIR", aud)
    return mem, aud


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def write_memory(mem, ticket, sections):
    """sections: dict of name -> body (or None for _pending_)."""
    lines = [f"# {ticket} — Test ticket\n"]
    for name, body in sections.items():
        lines.append(f"## {name}")
        lines.append(f"_{_now_iso()}_\n\n{body}" if body else "_pending_")
        lines.append("")
    (mem / f"{ticket}.md").write_text("\n".join(lines))


def write_audit(aud, rows):
    """rows: list of (ticket, event, detail)."""
    lines = [f"[{_now_iso()}] {tk} | {ev} | {dt}" for tk, ev, dt in rows]
    (aud / "2026-07-14.log").write_text("\n".join(lines) + "\n")


# --------------------------------------------------------------------------- #
# parse_memory
# --------------------------------------------------------------------------- #

def test_parse_memory_title_and_filled():
    text = (
        "# LIN-42 — Add CSV export\n\n"
        "## Spec\n_2026-07-14T00:00:00+00:00_\n\nthe problem\n\n"
        "## Architecture Decision\n_pending_\n"
    )
    p = dash.parse_memory(text)
    assert p["title"] == "Add CSV export"
    assert p["sections"]["Spec"]["filled"] is True
    assert p["sections"]["Spec"]["ts"] == "2026-07-14T00:00:00+00:00"
    assert p["sections"]["Architecture Decision"]["filled"] is False


def test_extract_urls():
    text = (
        "Repo: https://github.com/ashtilawat/cool-app\n"
        "PR: https://github.com/ashtilawat/cool-app/pull/3\n"
        "Production URL: https://cool-app.vercel.app\n"
    )
    u = dash.extract_urls(text)
    assert u["repo"] == "https://github.com/ashtilawat/cool-app"
    assert u["pr"] == "https://github.com/ashtilawat/cool-app/pull/3"
    assert u["deploy"] == "https://cool-app.vercel.app"


# --------------------------------------------------------------------------- #
# read_events
# --------------------------------------------------------------------------- #

def test_read_events_parses_and_filters(factory_dirs):
    _, aud = factory_dirs
    write_audit(aud, [
        ("LIN-1", "pipeline_start", "In Spec"),
        ("LIN-2", "agent_start:Spec", "spec-writing/SKILL.md"),
    ])
    allev = dash.read_events()
    assert len(allev) == 2
    one = dash.read_events("LIN-2")
    assert len(one) == 1 and one[0]["event"] == "agent_start:Spec"


# --------------------------------------------------------------------------- #
# derive_status
# --------------------------------------------------------------------------- #

def test_status_gate_waiting(factory_dirs):
    mem, aud = factory_dirs
    write_memory(mem, "LIN-42", {"Spec": "done", "Architecture Decision": None})
    write_audit(aud, [
        ("LIN-42", "agent_start:Spec", "x"),
        ("LIN-42", "agent_done:Spec", "x"),
        ("LIN-42", "Gate 1: Spec Review", "waiting for human approval"),
    ])
    s = dash.derive_status("LIN-42")
    assert s["gate_waiting"] == "Gate 1: Spec Review"
    assert s["stage"] == "Awaiting Gate 1"
    assert s["progress"][0]["state"] == "done"      # Spec
    assert s["progress"][1]["state"] == "pending"   # Architecture


def test_status_gate_cleared_after_approval(factory_dirs):
    mem, aud = factory_dirs
    write_memory(mem, "LIN-42", {"Spec": "done"})
    write_audit(aud, [
        ("LIN-42", "Gate 1: Spec Review", "waiting for human approval"),
        ("LIN-42", "Gate 1: Spec Review_approved", "In Arch"),
    ])
    assert dash.derive_status("LIN-42")["gate_waiting"] is None


def test_status_blocked(factory_dirs):
    mem, aud = factory_dirs
    write_memory(mem, "LIN-9", {"Spec": "done"})
    write_audit(aud, [("LIN-9", "blocked", "Gate 1")])
    s = dash.derive_status("LIN-9")
    assert s["blocked"] is True and s["stage"] == "Blocked"


def test_status_active_stage(factory_dirs):
    mem, aud = factory_dirs
    write_memory(mem, "LIN-7", {"Spec": None})
    write_audit(aud, [("LIN-7", "agent_start:Spec", "x")])
    s = dash.derive_status("LIN-7")
    assert s["progress"][0]["state"] == "active"
    assert s["stage"] == "Spec"


# --------------------------------------------------------------------------- #
# throughput + snapshot
# --------------------------------------------------------------------------- #

def test_throughput_counts_and_cycle(factory_dirs):
    mem, aud = factory_dirs
    write_memory(mem, "LIN-1", {"Deploy Log": "Production URL: https://a.vercel.app"})
    write_memory(mem, "LIN-2", {"Spec": None})
    write_audit(aud, [
        ("LIN-1", "pipeline_start", "In Spec"),
        ("LIN-1", "done", "pipeline complete"),
        ("LIN-2", "pipeline_start", "In Spec"),
    ])
    snap = dash.snapshot()
    tp = snap["throughput"]
    assert tp["total"] == 2
    assert tp["shipped_today"] == 1
    assert tp["in_flight"] == 1
    assert tp["blocked"] == 0
    assert tp["avg_cycle_min"] is not None  # LIN-1 has start->done


def test_snapshot_lists_gates(factory_dirs):
    mem, aud = factory_dirs
    write_memory(mem, "LIN-5", {"Spec": "done"})
    write_audit(aud, [("LIN-5", "Gate 1: Spec Review", "waiting for human approval")])
    snap = dash.snapshot()
    assert [g["ticket_id"] for g in snap["gates"]] == ["LIN-5"]


def test_list_tickets_excludes_template(factory_dirs):
    mem, _ = factory_dirs
    (mem / "_template.md").write_text("# t")
    write_memory(mem, "LIN-1", {"Spec": "x"})
    assert dash.list_tickets() == ["LIN-1"]
