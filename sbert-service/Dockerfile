FROM python:3.10-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_DEFAULT_TIMEOUT=180
ENV PIP_RETRIES=10

COPY requirements.txt .

RUN python -m pip install --upgrade pip setuptools wheel \
    && python -m pip install --no-cache-dir --timeout 180 --retries 10 \
      --index-url https://download.pytorch.org/whl/cpu \
      torch==2.0.1+cpu torchvision==0.15.2+cpu \
    && grep -vE '^(torch|torchvision|transformers|huggingface-hub)([<>=~!].*)?$' requirements.txt > /tmp/requirements-no-torch.txt \
    && python -m pip install --no-cache-dir --timeout 180 --retries 10 \
      transformers==4.30.2 huggingface-hub==0.14.1 \
    && python -m pip install --no-cache-dir --timeout 180 --retries 10 -r /tmp/requirements-no-torch.txt

COPY . .

EXPOSE 8000

# Run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]