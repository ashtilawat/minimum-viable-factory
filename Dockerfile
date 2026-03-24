FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install -r requirements.txt
RUN npm install -g @anthropic-ai/claude-code
COPY orchestrator.py .
CMD ["uvicorn", "orchestrator:app", "--host", "0.0.0.0", "--port", "8000"]
