"""FastAPI app — webhook endpoint and health check."""

import json

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, BackgroundTasks
from langsmith import traceable
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from orchestrator.config import DB_PATH, logger, require_python_for_orchestrator
from orchestrator.state import STATE_MAP
from orchestrator.audit import audit_log
from orchestrator.memory import init_memory
from orchestrator.linear import resolve_state_name
from orchestrator.graph import build_graph
from orchestrator import pipeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    require_python_for_orchestrator()
    async with AsyncSqliteSaver.from_conn_string(DB_PATH) as checkpointer:
        builder = build_graph()
        pipeline.graph = builder.compile(checkpointer=checkpointer)
        logger.info("Factory orchestrator started, graph compiled with SQLite checkpointer")
        yield


app = FastAPI(title="Software Factory", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


@traceable(run_type="chain", name="webhook_linear")
@app.post("/webhook/linear")
async def webhook_linear(request: Request, background_tasks: BackgroundTasks):
    body = await request.body()
    payload = json.loads(body)

    # Only process issue state changes
    if payload.get("type") != "Issue" or payload.get("action") != "update":
        return {"ok": True, "skipped": True}

    data = payload.get("data", {})
    state_id = data.get("stateId")
    if not state_id:
        return {"ok": True, "skipped": True}

    # Resolve the Linear state name from UUID
    state_name = await resolve_state_name(state_id)
    if not state_name or state_name not in STATE_MAP:
        return {"ok": True, "skipped": True, "state": state_name}

    # Extract ticket info
    ticket_number = data.get("number")
    ticket_id = f"LIN-{ticket_number}"
    title = data.get("title", "Untitled")

    audit_log(ticket_id, "webhook_received", f"{state_name} (stateId={state_id})")

    # Initialize memory file if this is a new ticket
    init_memory(ticket_id, title)

    # Run the pipeline in the background so the webhook returns immediately
    background_tasks.add_task(pipeline.run_pipeline, ticket_id, title, state_name)

    return {"ok": True, "ticket": ticket_id, "state": state_name}
