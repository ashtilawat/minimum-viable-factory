"""Read-only 'Mission Control' dashboard.

Everything here is derived from what the factory already writes to disk — the
per-ticket memory files (``memory/{TICKET}.md``) and the append-only audit log
(``audit/YYYY-MM-DD.log``). No external calls, no writes, no coupling to the
running graph, so it can never affect a pipeline. Served from the same FastAPI
app as a single static page plus a few JSON endpoints and one SSE stream.
"""

import re
import asyncio

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse, StreamingResponse

from orchestrator.config import MEMORY_DIR, AUDIT_DIR, logger

STATIC_DIR = Path(__file__).parent / "static"

# The six pipeline stages, in order: (memory section name, short display label).
# The section names match exactly what the agents append (see nodes/agents.py).
STAGES: list[tuple[str, str]] = [
    ("Spec", "Spec"),
    ("Architecture Decision", "Architecture"),
    ("Implementation", "Build"),
    ("Code Review", "Review"),
    ("Test Results", "Tests"),
    ("Deploy Log", "Deploy"),
]

# Gates sit between stages: Gate 1 after Spec, Gate 2 after Architecture,
# Gate 3 after Tests. Keyed by the stage index the gate follows.
GATE_AFTER = {0: "Gate 1", 1: "Gate 2", 4: "Gate 3"}

_EVENT_RE = re.compile(r"^\[(?P<ts>.*?)\] (?P<ticket>.*?) \| (?P<event>.*?) \| (?P<detail>.*)$")


# ---------------------------------------------------------------------------
# Memory parsing
# ---------------------------------------------------------------------------


def list_tickets() -> list[str]:
    """All ticket ids that have a memory file (excludes the template)."""
    if not MEMORY_DIR.exists():
        return []
    return sorted(
        p.stem for p in MEMORY_DIR.glob("*.md") if not p.stem.startswith("_")
    )


def parse_memory(text: str) -> dict:
    """Parse a memory file into a title and its ``## `` sections.

    A section is 'filled' once its ``_pending_`` placeholder has been replaced.
    """
    header = text.splitlines()[0] if text else ""
    title = header.lstrip("# ").strip()
    if "—" in title:  # "LIN-42 — Add CSV export"
        title = title.split("—", 1)[1].strip()

    sections: dict[str, dict] = {}
    for part in re.split(r"(?m)^## ", text)[1:]:
        name, _, rest = part.partition("\n")
        body = rest.strip()
        filled = bool(body) and not body.startswith("_pending_")
        ts_match = re.match(r"_([^_\n]+)_", body) if filled else None
        sections[name.strip()] = {
            "filled": filled,
            "ts": ts_match.group(1) if ts_match else None,
            "body": body,
        }
    return {"title": title, "sections": sections}


def _read_memory(ticket_id: str) -> dict:
    path = MEMORY_DIR / f"{ticket_id}.md"
    if not path.exists():
        return {"title": "", "sections": {}}
    return parse_memory(path.read_text())


def extract_urls(text: str) -> dict:
    """Pull repo / PR / deploy links out of a memory file (best effort)."""
    urls: dict[str, str] = {}
    pr = re.search(r"https://github\.com/[\w.-]+/[\w.-]+/pull/\d+", text)
    if pr:
        urls["pr"] = pr.group(0)
    repo = re.search(r"https://github\.com/[\w.-]+/[\w.-]+(?![\w./-])", text)
    if repo and "/pull/" not in repo.group(0):
        urls["repo"] = repo.group(0)
    deploy = re.search(r"https://[\w.-]+\.vercel\.app[\w./-]*", text)
    if deploy:
        urls["deploy"] = deploy.group(0)
    return urls


# ---------------------------------------------------------------------------
# Audit event parsing
# ---------------------------------------------------------------------------


def read_events(ticket_id: str | None = None) -> list[dict]:
    """Parse all audit-log lines (chronological). Optionally filter by ticket."""
    if not AUDIT_DIR.exists():
        return []
    events: list[dict] = []
    for log in sorted(AUDIT_DIR.glob("*.log")):
        for line in log.read_text().splitlines():
            m = _EVENT_RE.match(line)
            if not m:
                continue
            row = m.groupdict()
            if ticket_id and row["ticket"] != ticket_id:
                continue
            events.append(row)
    return events


def _parse_ts(ts: str) -> datetime | None:
    try:
        return datetime.fromisoformat(ts)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Status derivation
# ---------------------------------------------------------------------------


def derive_status(ticket_id: str, events: list[dict] | None = None) -> dict:
    """Combine memory + audit into a single status object for a ticket."""
    mem = _read_memory(ticket_id)
    evs = events if events is not None else read_events(ticket_id)
    sections = mem["sections"]

    # Per-stage progress: done (filled) / active (agent started, not yet filled) / pending.
    started = {e["event"].split(":", 1)[1] for e in evs if e["event"].startswith("agent_start:")}
    progress = []
    for name, label in STAGES:
        sec = sections.get(name, {})
        if sec.get("filled"):
            state = "done"
        elif name in started:
            state = "active"
        else:
            state = "pending"
        progress.append({"stage": label, "section": name, "state": state})

    # Gate currently awaiting a human: last "Gate N …" waiting event that hasn't
    # since been approved or superseded by a block/done.
    gate_waiting = None
    for e in evs:
        ev = e["event"]
        if ev.startswith("Gate ") and "waiting" in e["detail"]:
            gate_waiting = ev
        elif ev.endswith("_approved") or ev in ("blocked", "done", "timeout", "error"):
            gate_waiting = None

    # Blocked: a terminal failure not superseded by later progress.
    blocked = False
    for e in evs:
        if e["event"] in ("blocked", "timeout", "error"):
            blocked = True
        elif e["event"] in ("done", "pipeline_start", "pipeline_resume") or e["event"].startswith("agent_start:"):
            blocked = False
    done = any(e["event"] == "done" for e in evs)

    # Human-facing current stage label.
    if done:
        stage = "Done"
    elif blocked:
        stage = "Blocked"
    elif gate_waiting:
        stage = f"Awaiting {gate_waiting.split(':', 1)[0]}"
    else:
        active = next((p["stage"] for p in progress if p["state"] == "active"), None)
        nxt = next((p["stage"] for p in progress if p["state"] == "pending"), None)
        stage = active or nxt or "Done"

    urls = extract_urls((MEMORY_DIR / f"{ticket_id}.md").read_text()) if (MEMORY_DIR / f"{ticket_id}.md").exists() else {}
    last_ts = evs[-1]["ts"] if evs else None

    return {
        "ticket_id": ticket_id,
        "title": mem["title"],
        "stage": stage,
        "progress": progress,
        "gate_waiting": gate_waiting,
        "blocked": blocked,
        "done": done,
        "urls": urls,
        "last_ts": last_ts,
    }


def throughput(statuses: list[dict], events: list[dict]) -> dict:
    """Aggregate factory-wide metrics from statuses + the full event stream."""
    today = datetime.now(timezone.utc).date()

    shipped_today = 0
    for e in events:
        if e["event"] == "done":
            ts = _parse_ts(e["ts"])
            if ts and ts.date() == today:
                shipped_today += 1

    # Cycle time: first start -> done, per ticket.
    starts: dict[str, datetime] = {}
    cycles: list[float] = []
    for e in events:
        ts = _parse_ts(e["ts"])
        if not ts:
            continue
        if e["event"] in ("pipeline_start", "webhook_received") and e["ticket"] not in starts:
            starts[e["ticket"]] = ts
        elif e["event"] == "done" and e["ticket"] in starts:
            cycles.append((ts - starts[e["ticket"]]).total_seconds())

    avg_cycle_min = round(sum(cycles) / len(cycles) / 60) if cycles else None

    return {
        "shipped_today": shipped_today,
        "in_flight": sum(1 for s in statuses if not s["done"] and not s["blocked"]),
        "blocked": sum(1 for s in statuses if s["blocked"]),
        "total": len(statuses),
        "avg_cycle_min": avg_cycle_min,
    }


def snapshot() -> dict:
    """Full dashboard state in one object."""
    all_events = read_events()
    by_ticket: dict[str, list[dict]] = {}
    for e in all_events:
        by_ticket.setdefault(e["ticket"], []).append(e)

    statuses = [derive_status(t, by_ticket.get(t, [])) for t in list_tickets()]
    # Newest activity first.
    statuses.sort(key=lambda s: s["last_ts"] or "", reverse=True)

    return {
        "tickets": statuses,
        "throughput": throughput(statuses, all_events),
        "recent_events": all_events[-100:],
        "gates": [s for s in statuses if s["gate_waiting"] and not s["blocked"] and not s["done"]],
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

router = APIRouter()


@router.get("/")
async def dashboard_page():
    return FileResponse(STATIC_DIR / "dashboard.html")


@router.get("/api/state")
async def api_state():
    return snapshot()


@router.get("/api/ticket/{ticket_id}")
async def api_ticket(ticket_id: str):
    mem = _read_memory(ticket_id)
    return {
        "ticket_id": ticket_id,
        "title": mem["title"],
        "sections": mem["sections"],
        "status": derive_status(ticket_id),
    }


async def _tail_audit():
    """Yield audit-log lines as SSE events, following the newest daily file."""
    current: Path | None = None
    offset = 0
    while True:
        logs = sorted(AUDIT_DIR.glob("*.log")) if AUDIT_DIR.exists() else []
        newest = logs[-1] if logs else None
        if newest != current:
            current, offset = newest, 0
        if current and current.exists():
            with current.open() as f:
                f.seek(offset)
                for line in f:
                    if line.endswith("\n"):
                        yield f"data: {line.rstrip()}\n\n"
                offset = f.tell()
        await asyncio.sleep(1)


@router.get("/api/events")
async def api_events():
    return StreamingResponse(_tail_audit(), media_type="text/event-stream")
