"""Shared test fixtures — isolate memory/audit dirs to a tmp path."""

import pytest

from orchestrator import memory as memory_mod
from orchestrator import audit as audit_mod

TEMPLATE = (
    "# {{TICKET_ID}} — {{TICKET_TITLE}}\n\n"
    "## Spec\n_pending_\n\n"
    "## Architecture Decision\n_pending_\n\n"
    "## Implementation\n_pending_\n\n"
    "## Code Review\n_pending_\n\n"
    "## Test Results\n_pending_\n\n"
    "## Deploy Log\n_pending_\n"
)


@pytest.fixture
def mem_dir(tmp_path, monkeypatch):
    """Point memory + audit at a tmp dir with a fresh template."""
    mdir = tmp_path / "memory"
    mdir.mkdir()
    template = mdir / "_template.md"
    template.write_text(TEMPLATE)

    adir = tmp_path / "audit"

    monkeypatch.setattr(memory_mod, "MEMORY_DIR", mdir)
    monkeypatch.setattr(memory_mod, "TEMPLATE_PATH", template)
    monkeypatch.setattr(audit_mod, "AUDIT_DIR", adir)
    return mdir
