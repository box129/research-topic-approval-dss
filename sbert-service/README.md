# SBERT Embedding Service

> **Historical/research-only component.** The current production and staging
> architecture uses Voyage `voyage-4-large` through the Node backend and does
> not deploy, depend on, or fall back to this FastAPI service. Use the
> [Phase 6 production runbook](../docs/deployment/deployment-runbook.md) for
> current deployment instructions. This document is retained only for legacy
> evaluation and reproducibility work.

FastAPI microservice for generating semantic embeddings using Sentence-BERT (SBERT).

## Overview

This service provides REST API endpoints for generating 384-dimensional semantic embeddings using the `sentence-transformers/all-MiniLM-L6-v2` model. It's designed to be a lightweight, fast, and easy-to-use microservice for semantic similarity tasks.

## Features

- **FastAPI Framework**: High-performance async API
- **SBERT Model**: Uses `all-MiniLM-L6-v2` for efficient embeddings
- **CORS Enabled**: Allows requests from any origin
- **Comprehensive Logging**: Detailed logging for debugging and monitoring
- **Error Handling**: Robust error handling with informative messages
- **Auto Documentation**: Interactive API docs at `/docs`

## Requirements

- Python 3.8+
- pip

## Installation

### 1. Create Virtual Environment

```bash
cd sbert-service
python -m venv venv
```

### 2. Activate Virtual Environment

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (CMD):**
```cmd
venv\Scripts\activate.bat
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

## Running the Service

### Development Mode

```bash
uvicorn app:app --reload --port 8000
```

### Release-Candidate Mode

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
```

The service will be available at `http://localhost:8000`

Use one worker for the release candidate unless memory capacity has been measured. Multiple workers can load separate model instances and substantially increase memory usage.

Do not expose this service directly to the public internet. The historical
backend integration used `SBERT_SERVICE_URL`; current Voyage production/staging
deployments must not configure or require that value.

## API Endpoints

### 1. Health Check

**GET** `/health`

Check if the service is running and the model is loaded.

**Response:**
```json
{
  "status": "healthy",
  "model": "all-MiniLM-L6-v2"
}
```

**Example:**
```bash
curl http://localhost:8000/health
```

### 2. Generate Embedding

**POST** `/embed`

Generate a 384-dimensional semantic embedding for the provided text.

**Request Body:**
```json
{
  "text": "Machine learning is a subset of artificial intelligence"
}
```

**Response:**
```json
{
  "embedding": [0.123, -0.456, 0.789],
  "dimension": 384
}
```

For release evidence, record only `dimension: 384` and health status. Do not paste full embedding vectors into reports.

**Example:**
```bash
curl -X POST http://localhost:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Machine learning is a subset of artificial intelligence"}'
```

### 3. Root Endpoint

**GET** `/`

Get service information and available endpoints.

**Response:**
```json
{
  "service": "SBERT Embedding Service",
  "version": "1.0.0",
  "model": "sentence-transformers/all-MiniLM-L6-v2",
  "embedding_dimension": 384,
  "endpoints": {
    "health": "/health",
    "embed": "/embed",
    "docs": "/docs"
  }
}
```

## Interactive Documentation

Once the service is running, visit:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Testing

### Test Health Endpoint

```bash
curl http://localhost:8000/health
```

Expected output:
```json
{"status":"healthy","model":"all-MiniLM-L6-v2"}
```

### Test Embedding Endpoint

```bash
curl -X POST http://localhost:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!"}'
```

Expected output:
```json
{
  "embedding": [0.0234, -0.0567, ...],
  "dimension": 384
}
```

## Model Information

**Model**: `sentence-transformers/all-MiniLM-L6-v2`

- **Embedding Dimension**: 384
- **Max Sequence Length**: 256 tokens
- **Performance**: ~14,200 sentences/second on V100 GPU
- **Use Cases**: Semantic search, clustering, duplicate detection

## Error Handling

The service includes comprehensive error handling:

- **400 Bad Request**: Invalid input (empty text, etc.)
- **500 Internal Server Error**: Model loading or embedding generation failures
- **503 Service Unavailable**: Model not loaded

## Logging

The service logs all important events:

- Model loading status
- Embedding generation requests
- Errors and exceptions

Logs are output to stdout in the format:
```
2024-01-15 10:30:45 - __main__ - INFO - Loading SBERT model: sentence-transformers/all-MiniLM-L6-v2
```

## Dependencies

- **fastapi** (0.109.0): Modern web framework for building APIs
- **uvicorn** (0.27.0): ASGI server for running FastAPI
- **sentence-transformers** (2.2.2): Library for state-of-the-art sentence embeddings

## Project Structure

```
sbert-service/
├── app.py              # Main FastAPI application
├── requirements.txt    # Python dependencies
├── .gitignore         # Git ignore rules
└── README.md          # This file
```

## Integration Example

### From Node.js Backend

```javascript
const axios = require('axios');

async function getEmbedding(text) {
  try {
    const response = await axios.post('http://localhost:8000/embed', {
      text: text
    });
    return response.data.embedding;
  } catch (error) {
    console.error('Error getting embedding:', error);
    throw error;
  }
}

// Usage
const embedding = await getEmbedding('Machine learning algorithms');
console.log(`Embedding dimension: ${embedding.length}`);
```

### From Python

```python
import requests

def get_embedding(text: str):
    response = requests.post(
        'http://localhost:8000/embed',
        json={'text': text}
    )
    return response.json()['embedding']

# Usage
embedding = get_embedding('Machine learning algorithms')
print(f"Embedding dimension: {len(embedding)}")
```

## Performance Considerations

1. **First Request**: The first embedding request may be slower as the model loads into memory
2. **Batch Processing**: For multiple texts, consider implementing a batch endpoint
3. **GPU Acceleration**: The service will automatically use GPU if available
4. **Memory**: The model requires ~90MB of RAM when loaded

## Troubleshooting

### Model Download Issues

If the model fails to download, ensure you have internet connectivity. The model will be cached in `~/.cache/huggingface/` after the first download.

### Port Already in Use

If port 8000 is already in use, specify a different port:
```bash
uvicorn app:app --port 8001
```

### Virtual Environment Issues

If you encounter issues with the virtual environment, try:
```bash
deactivate  # If already in a venv
rm -rf venv  # Remove old venv
python -m venv venv  # Create new venv
```

## License

MIT License

## Support

For issues or questions, please refer to the main project documentation.
