FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8001 \
    SMARTMAINT_DB=/data/smartmaint.sqlite3 \
    SMARTMAINT_VECTOR_DB=/data/rag-vectors.sqlite3 \
    SMARTMAINT_ANSWER_MODE=template \
    SMARTMAINT_RETRIEVAL_MODE=keyword

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY frontend/ frontend/
COPY fixtures/ fixtures/
RUN mkdir -p /data

EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8001')+'/api/health',timeout=4)"
CMD ["python", "-m", "backend.serve"]
