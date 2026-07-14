"""Factory-wide configuration: env vars, paths, constants."""

import os
import logging
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Directories
MEMORY_DIR = Path("memory")
AUDIT_DIR = Path("audit")
TEMPLATE_PATH = MEMORY_DIR / "_template.md"
SKILLS_DIR = Path(".claude/skills")
DB_PATH = "factory.db"

# API keys and secrets
LINEAR_API_KEY = os.getenv("LINEAR_API_KEY", "")
LINEAR_WEBHOOK_SECRET = os.getenv("LINEAR_WEBHOOK_SECRET", "")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")

GITHUB_ORG = os.getenv("GITHUB_ORG", "ashtilawat")
WORKSPACE_DIR = Path("/app/workspace")

# Timeouts
AGENT_TIMEOUT = 1800  # 30 minutes — per individual agent session
PIPELINE_TIMEOUT = 4 * 60 * 60  # 4 hours — overall safety cap for a graph run/
                                # segment, which may run many agents (decompose +
                                # N dev subtasks + review + test). Must sit well
                                # above a single AGENT_TIMEOUT.

# Logging
logger = logging.getLogger("factory")
logging.basicConfig(level=logging.INFO)
