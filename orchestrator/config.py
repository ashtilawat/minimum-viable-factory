"""Factory-wide configuration: env vars, paths, constants."""

import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parent.parent

# Directories
MEMORY_DIR = REPO_ROOT / "memory"
AUDIT_DIR = REPO_ROOT / "audit"
TEMPLATE_PATH = MEMORY_DIR / "_template.md"
SKILLS_DIR = REPO_ROOT / ".claude/skills"
AGENT_CONTEXT_FILE = REPO_ROOT / ".claude/CLAUDE.md"
DB_PATH = str(REPO_ROOT / "factory.db")

# Runtime selection
AGENT_RUNTIME = os.getenv("AGENT_RUNTIME", "claude").strip().lower()
CODEX_BIN = os.getenv("CODEX_BIN", "codex").strip() or "codex"
CODEX_MODEL = os.getenv("CODEX_MODEL", "gpt-5.4-mini").strip()
_raw_codex_stream = os.getenv("CODEX_STREAM_OUTPUT")
if _raw_codex_stream is None or _raw_codex_stream.strip() == "":
    CODEX_STREAM_OUTPUT = True
else:
    CODEX_STREAM_OUTPUT = _raw_codex_stream.strip().lower() not in ("0", "false", "no", "off")

# API keys and secrets
LINEAR_API_KEY = os.getenv("LINEAR_API_KEY", "")
LINEAR_WEBHOOK_SECRET = os.getenv("LINEAR_WEBHOOK_SECRET", "")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")

GITHUB_ORG = os.getenv("GITHUB_ORG", "ashtilawat")
WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", str(REPO_ROOT / "workspace")))
if not WORKSPACE_DIR.is_absolute():
    WORKSPACE_DIR = (REPO_ROOT / WORKSPACE_DIR).resolve()

# Timeouts
AGENT_TIMEOUT = 1800  # 30 minutes

# LangGraph async nodes use get_config()/interrupt(), which rely on asyncio context
# propagation; LangGraph documents Python 3.11+ for async (see langgraph.config).
MIN_PYTHON_ORCHESTRATOR = (3, 11)

# Logging
logger = logging.getLogger("factory")
logging.basicConfig(level=logging.INFO)


def require_python_for_orchestrator() -> None:
    """Fail fast if the interpreter cannot support LangGraph async interrupt."""
    if sys.version_info < MIN_PYTHON_ORCHESTRATOR:
        ver = ".".join(str(x) for x in sys.version_info[:3])
        raise RuntimeError(
            f"Python 3.11+ is required to run the factory orchestrator (found {ver}). "
            "LangGraph interrupt()/get_config() in async code need contextvar support "
            "from asyncio.create_task (Python 3.11+). Recreate the venv with python3.11."
        )
