"""Software Factory Orchestrator — FastAPI + LangGraph."""

__all__ = ["app"]


def __getattr__(name):
    # Lazily expose the FastAPI app so `uvicorn orchestrator:app` still works,
    # without forcing every submodule import to pull in api.py (and its
    # AsyncSqliteSaver dependency). Keeps the package importable for testing.
    if name == "app":
        from orchestrator.api import app

        return app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
