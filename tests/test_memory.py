"""Tests for the append-only ticket memory (C1).

The critical bug: the original append_memory replaced the literal
``## {section}\n_pending_`` marker exactly once. Every subsequent write to the
same section found no marker and silently wrote unchanged text — so in parallel
dev, where all N subtasks append to "Implementation", only the first survived.
"""

from orchestrator import memory as memory_mod


def _read(mem_dir, ticket="LIN-1"):
    return (mem_dir / f"{ticket}.md").read_text()


def test_init_memory_interpolates_template(mem_dir):
    memory_mod.init_memory("LIN-1", "Cool App")
    text = _read(mem_dir)
    assert "LIN-1" in text
    assert "Cool App" in text
    assert "{{TICKET_ID}}" not in text


def test_first_write_replaces_pending(mem_dir):
    memory_mod.init_memory("LIN-1", "Cool App")
    memory_mod.append_memory("LIN-1", "Spec", "the spec body")
    text = _read(mem_dir)
    assert "the spec body" in text
    # the _pending_ marker for that section should be gone
    spec_block = text.split("## Spec", 1)[1].split("## ", 1)[0]
    assert "_pending_" not in spec_block


def test_repeated_same_section_writes_all_persist(mem_dir):
    """C1 regression: N appends to the SAME section must all survive."""
    memory_mod.init_memory("LIN-1", "Cool App")
    memory_mod.append_memory("LIN-1", "Implementation", "first output")
    memory_mod.append_memory("LIN-1", "Implementation", "second output")
    memory_mod.append_memory("LIN-1", "Implementation", "third output")
    text = _read(mem_dir)
    assert "first output" in text
    assert "second output" in text
    assert "third output" in text


def test_writes_to_distinct_sections_all_persist(mem_dir):
    memory_mod.init_memory("LIN-1", "Cool App")
    memory_mod.append_memory("LIN-1", "Code Review", "review body")
    memory_mod.append_memory("LIN-1", "Test Results", "test body")
    text = _read(mem_dir)
    assert "review body" in text
    assert "test body" in text


def test_unknown_section_is_appended(mem_dir):
    """A section not present in the template (e.g. "Error") still records."""
    memory_mod.init_memory("LIN-1", "Cool App")
    memory_mod.append_memory("LIN-1", "Error", "something broke")
    text = _read(mem_dir)
    assert "## Error" in text
    assert "something broke" in text


def test_section_content_stays_under_its_header(mem_dir):
    """Repeated writes land under the right header, not appended past later ones."""
    memory_mod.init_memory("LIN-1", "Cool App")
    memory_mod.append_memory("LIN-1", "Spec", "spec one")
    memory_mod.append_memory("LIN-1", "Deploy Log", "deployed")
    memory_mod.append_memory("LIN-1", "Spec", "spec two")
    text = _read(mem_dir)
    spec_block = text.split("## Spec", 1)[1].split("## ", 1)[0]
    assert "spec one" in spec_block
    assert "spec two" in spec_block
