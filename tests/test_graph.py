"""Structural tests for the pipeline graph wiring and routing functions."""

from orchestrator.graph import build_graph, should_block, qa_fanout


EXPECTED_NODES = {
    "pm_agent", "gate_1", "architect_agent", "gate_2", "decompose",
    "dev_parallel", "review_agent", "test_agent", "gate_3", "deploy_agent",
    "done_handler", "blocked_handler",
}


def test_build_graph_has_all_nodes():
    builder = build_graph()
    assert EXPECTED_NODES.issubset(set(builder.nodes))


def test_build_graph_compiles():
    # Compiles without a checkpointer (in-memory) — proves the DAG is valid.
    compiled = build_graph().compile()
    assert compiled is not None


def test_should_block_routes_on_error():
    assert should_block({"error": "boom"}) == "blocked_handler"
    assert should_block({"current_state": "Blocked"}) == "blocked_handler"
    assert should_block({"current_state": "Spec", "error": ""}) == "continue"


def test_qa_fanout_targets_exist_in_graph():
    builder = build_graph()
    for target in qa_fanout({}):
        assert target in builder.nodes
    # happy path fans out to both QA agents
    assert set(qa_fanout({})) == {"review_agent", "test_agent"}
    # error path blocks
    assert qa_fanout({"error": "x"}) == ["blocked_handler"]
