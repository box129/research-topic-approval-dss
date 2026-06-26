FROM python:3.10-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_DEFAULT_TIMEOUT=180
ENV PIP_RETRIES=10
ENV SBERT_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2

COPY requirements.txt .

RUN python -m pip install --upgrade pip setuptools wheel \
    && python -m pip install --no-cache-dir --timeout 180 --retries 10 \
      --index-url https://download.pytorch.org/whl/cpu \
      torch==2.0.1+cpu \
    && python -m pip install --no-cache-dir --timeout 180 --retries 10 \
      -r requirements.txt

COPY app.py .

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
