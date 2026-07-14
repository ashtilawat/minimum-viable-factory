"""Slack webhook helper."""

import httpx
from langsmith import traceable

from orchestrator.config import SLACK_WEBHOOK_URL, logger


@traceable(run_type="tool", name="slack_post")
async def post_slack(message: str) -> None:
    if not SLACK_WEBHOOK_URL:
        logger.warning("SLACK_WEBHOOK_URL not set, skipping: %s", message)
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(SLACK_WEBHOOK_URL, json={"text": message})
        if resp.status_code >= 400:
            logger.warning("Slack webhook HTTP %s: %s", resp.status_code, resp.text[:200])
    except httpx.HTTPError as e:
        # Never let a Slack outage break the pipeline.
        logger.warning("Slack post failed: %s", e)
