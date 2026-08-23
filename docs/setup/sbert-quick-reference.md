# SBERT Service - Quick Reference Guide

> **Legacy research-only reference.** It is not a production or staging
> dependency. The current semantic provider is Voyage `voyage-4-large`; use the
> [Phase 6 deployment runbook](../deployment/deployment-runbook.md) for current
> operations.

## 🚀 Quick Start (After Installation)

```powershell
# Start service
.\start.ps1

# Or manually
.\venv\Scripts\Activate.ps1
uvicorn app:app --reload --port 8000
```

## 📡 API Endpoints

### Health Check
```bash
GET http://localhost:8000/health
```
**Response:**
```json
{"status": "healthy", "model": "all-MiniLM-L6-v2"}
```

### Generate Embedding
```bash
POST http://localhost:8000/embed
Content-Type: application/json

{"text": "Your text here"}
```
**Response:**
```json
{
  "embedding": [0.123, -0.456, ...],  // 384 values
  "dimension": 384
}
```

### Service Info
```bash
GET http://localhost:8000/
```

### API Documentation
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🧪 Testing

### Quick Test
```powershell
# Health check
curl http://localhost:8000/health

# Generate embedding
curl -X POST http://localhost:8000/embed -H "Content-Type: application/json" -d "{\"text\": \"Hello world\"}"
```

### Run Test Suite
```powershell
pip install requests
python test_service.py
```

## 🔧 Common Commands

### Installation
```powershell
# Create venv
python -m venv venv

# Activate venv
.\venv\Scripts\Activate.ps1

# Install dependencies (CPU-only PyTorch)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install fastapi uvicorn sentence-transformers

# Or from requirements
pip install -r requirements.txt
```

### Running
```powershell
# Development (auto-reload)
uvicorn app:app --reload --port 8000

# Production (4 workers)
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4

# Different port
uvicorn app:app --port 8001
```

### Docker
```bash
# Build and run
docker build -t sbert-service .
docker run -p 8000:8000 sbert-service

# Using docker-compose
docker-compose up
docker-compose down
```

## 📊 Model Information

| Property | Value |
|----------|-------|
| Model | sentence-transformers/all-MiniLM-L6-v2 |
| Embedding Dimension | 384 |
| Max Sequence Length | 256 tokens |
| Model Size | ~90 MB |
| Performance | ~14,200 sentences/sec (V100 GPU) |

## 🔌 Integration Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

async function getEmbedding(text) {
  const response = await axios.post('http://localhost:8000/embed', { text });
  return response.data.embedding;
}

// Usage
const embedding = await getEmbedding('Machine learning');
console.log(`Dimension: ${embedding.length}`); // 384
```

### Python
```python
import requests

def get_embedding(text: str):
    response = requests.post(
        'http://localhost:8000/embed',
        json={'text': text}
    )
    return response.json()['embedding']

# Usage
embedding = get_embedding('Machine learning')
print(f"Dimension: {len(embedding)}")  # 384
```

### cURL
```bash
curl -X POST http://localhost:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Machine learning"}'
```

## ⚠️ Troubleshooting

### Port Already in Use
```powershell
# Use different port
uvicorn app:app --port 8001
```

### Model Download Issues
- Ensure internet connectivity
- Model cached in `~/.cache/huggingface/`
- Requires ~200MB free disk space

### Virtual Environment Issues
```powershell
deactivate
Remove-Item -Recurse -Force venv
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### Installation Timeouts
See `SETUP-INSTRUCTIONS.md` for alternative installation methods

## 📁 File Structure

```
sbert-service/
├── app.py                  # Main application
├── requirements.txt        # Dependencies
├── test_service.py        # Tests
├── start.ps1              # Quick start
├── Dockerfile             # Docker config
├── docker-compose.yml     # Docker Compose
├── README.md              # Full documentation
├── SETUP-INSTRUCTIONS.md  # Troubleshooting
├── SERVICE-STATUS.md      # Current status
└── QUICK-REFERENCE.md     # This file
```

## 🎯 Performance Tips

1. **First Request**: May take 2-3 seconds (model loading)
2. **Batch Processing**: Process multiple texts in sequence
3. **GPU**: Install CUDA-enabled PyTorch for GPU acceleration
4. **Workers**: Use multiple workers for production (`--workers 4`)
5. **Caching**: Model is cached after first download

## 📝 Response Format

### Success (200)
```json
{
  "embedding": [0.123, -0.456, ...],
  "dimension": 384
}
```

### Error (422)
```json
{
  "detail": [
    {
      "loc": ["body", "text"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### Error (500)
```json
{
  "detail": "Error message here"
}
```

## 🔐 Security Notes

- CORS enabled for all origins (configure for production)
- No authentication (add middleware for production)
- Input validation via Pydantic models
- Error messages sanitized

## 📈 Monitoring

### Logs
```
2024-01-15 10:30:45 - INFO - Loading SBERT model
2024-01-15 10:30:47 - INFO - Model loaded successfully
2024-01-15 10:31:00 - INFO - Embedding generated for text of length 25
```

### Health Check
```bash
# Automated health check
while true; do curl http://localhost:8000/health; sleep 30; done
```

## 🚢 Deployment Checklist

- [ ] Install dependencies
- [ ] Test endpoints locally
- [ ] Configure CORS for production
- [ ] Add authentication middleware
- [ ] Set up logging
- [ ] Configure multiple workers
- [ ] Set up monitoring
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL/TLS
- [ ] Test under load

## 📞 Support

For issues or questions:
1. Check `README.md` for detailed documentation
2. See `SETUP-INSTRUCTIONS.md` for troubleshooting
3. Review `SERVICE-STATUS.md` for current status
4. Check logs for error messages

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Port**: 8000 (default)
