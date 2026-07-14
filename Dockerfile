FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl git && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install -r requirements.txt
RUN npm install -g @anthropic-ai/claude-code
COPY orchestrator/ ./orchestrator/
# Pre-create the bind-mount points and hand ownership to the unprivileged user,
# so the app can write cloned repos, memory, and audit logs at runtime.
RUN mkdir -p /app/workspace /app/memory /app/audit && \
    useradd -m factory && \
    chown -R factory:factory /app
USER factory
CMD ["uvicorn", "orchestrator:app", "--host", "0.0.0.0", "--port", "8000"]
