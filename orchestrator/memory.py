"""Memory file helpers — init and append-only writes."""

import threading

from datetime import datetime, timezone
from pathlib import Path

from langsmith import traceable

from orchestrator.config import MEMORY_DIR, TEMPLATE_PATH
from orchestrator.audit import audit_log

# Serialize read-modify-write so writes never clobber each other, even if
# append_memory is ever called from a thread pool.
_write_lock = threading.Lock()


@traceable(run_type="tool", name="init_memory")
def init_memory(ticket_id: str, title: str) -> Path:
    path = MEMORY_DIR / f"{ticket_id}.md"
    if path.exists():
        return path
    MEMORY_DIR.mkdir(exist_ok=True)
    template = TEMPLATE_PATH.read_text()
    content = template.replace("{{TICKET_ID}}", ticket_id).replace("{{TICKET_TITLE}}", title)
    path.write_text(content)
    audit_log(ticket_id, "memory_init", str(path))
    return path


@traceable(run_type="tool", name="append_memory")
def append_memory(ticket_id: str, section: str, content: str) -> None:
    """Append a timestamped block under ``## {section}``.

    Unlike a one-shot ``_pending_`` replacement, this keeps working when a
    section is written more than once (e.g. every parallel-dev subtask appends
    to "Implementation"): the first write replaces the ``_pending_`` placeholder,
    and later writes accumulate under the same header instead of being dropped.
    """
    path = MEMORY_DIR / f"{ticket_id}.md"
    ts = datetime.now(timezone.utc).isoformat()
    block = f"_{ts}_\n\n{content}"
    marker = f"## {section}"

    with _write_lock:
        text = path.read_text()
        header_idx = text.find(marker)

        if header_idx == -1:
            # Section not in the template — start a new one at the end.
            with path.open("a") as f:
                f.write(f"\n{marker}\n{block}\n")
        else:
            # Body spans from just after the header line to the next "## "
            # header (or EOF).
            nl = text.find("\n", header_idx)
            body_start = len(text) if nl == -1 else nl + 1
            nxt = text.find("\n## ", body_start)
            body_end = len(text) if nxt == -1 else nxt
            body = text[body_start:body_end]

            if body.strip() == "_pending_":
                new_body = f"{block}\n"
            else:
                new_body = f"{body.rstrip(chr(10))}\n\n{block}\n"

            text = text[:body_start] + new_body + text[body_end:]
            path.write_text(text)

    audit_log(ticket_id, f"memory_append:{section}", f"{len(content)} chars")
