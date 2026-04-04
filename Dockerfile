FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl git && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install -r requirements.txt
RUN npm install -g @anthropic-ai/claude-code && \
    npm install -g @openai/codex
COPY orchestrator/ ./orchestrator/
RUN useradd -m factory && chown -R factory:factory /app
USER factory
# Cursor Agent CLI (https://cursor.com/cli) — installs to ~/.local/bin
RUN curl -fsSL https://cursor.com/install | bash
ENV PATH="/home/factory/.local/bin:${PATH}"
CMD ["uvicorn", "orchestrator:app", "--host", "0.0.0.0", "--port", "8000"]
