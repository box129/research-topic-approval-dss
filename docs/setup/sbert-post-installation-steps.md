# Post-Installation Steps

> **Legacy research-only instructions.** Current production and staging use
> Voyage `voyage-4-large` from the Node backend and must not require this
> service. Follow the [Phase 6 deployment runbook](../deployment/deployment-runbook.md)
> for supported operations.

## Once Dependencies Are Installed

### 1. Verify Installation
```powershell
cd topic-similarity-mvp/sbert-service
pip list | findstr "torch fastapi uvicorn sentence-transformers"
```

Expected output:
```
fastapi                0.109.0
sentence-transformers  2.2.2
torch                  2.10.0+cpu
uvicorn                0.27.0
```

### 2. Start the Service
```powershell
# Make sure you're in the sbert-service directory
cd topic-similarity-mvp/sbert-service

# Activate virtual environment (if not already active)
.\venv\Scripts\Activate.ps1

# Start the server
uvicorn app:app --port 8000
```

Expected output:
```
INFO:     Started server process [XXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

**Note:** The first startup will download the SBERT model (~90MB) which may take 30-60 seconds.

### 3. Test the Health Endpoint
Open a new terminal and run:
```powershell
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "model": "sentence-transformers/all-MiniLM-L6-v2"
}
```

### 4. Test the Embed Endpoint
```powershell
curl -X POST http://localhost:8000/embed -H "Content-Type: application/json" -d "{\"text\": \"Hello world\"}"
```

Expected response:
```json
{
  "embedding": [0.123, -0.456, ...],  // 384 numbers
  "text_length": 11,
  "processing_time": 0.0234
}
```

### 5. Run Comprehensive Tests
```powershell
# In a new terminal (keep the server running)
cd topic-similarity-mvp/sbert-service
python comprehensive_test.py
```

This will run all tests and generate a `test_results.json` file.

### 6. Commit to Git
```powershell
# Stop the server (Ctrl+C in the server terminal)

# Go to project root
cd topic-similarity-mvp

# Add all sbert-service files
git add sbert-service/

# Commit
git commit -m "feat(sbert): implement FastAPI embedding service

- Add FastAPI application with /health and /embed endpoints
- Implement SBERT model integration (all-MiniLM-L6-v2)
- Add comprehensive test suite with 30+ test cases
- Include Docker and Docker Compose configurations
- Add complete documentation and setup guides
- Configure CORS, error handling, and logging
- Generate 384-dimensional semantic embeddings"
```

### 7. Verify Commit
```powershell
git log -1 --stat
```

## Troubleshooting

### Service Won't Start
- Check if port 8000 is already in use
- Verify all dependencies are installed
- Check Python version (should be 3.10+)

### Model Download Fails
- Ensure internet connection
- Check firewall settings
- Verify access to huggingface.co

### Tests Fail
- Ensure service is running on port 8000
- Check if model has been downloaded
- Verify network connectivity

## Quick Reference

### Start Service
```powershell
cd topic-similarity-mvp/sbert-service
.\venv\Scripts\Activate.ps1
uvicorn app:app --port 8000
```

### Run Tests
```powershell
python comprehensive_test.py
```

### View API Docs
Open browser: http://localhost:8000/docs

### Stop Service
Press `Ctrl+C` in the terminal running uvicorn
