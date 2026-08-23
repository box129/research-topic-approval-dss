# SBERT Service Setup Instructions

> **Legacy research-only instructions.** The current deployment contract does
> not deploy or depend on SBERT/FastAPI. Use these instructions only for
> historical evaluation work under the explicit `legacy-sbert` profile; see the
> [Phase 6 deployment runbook](../deployment/deployment-runbook.md) for the
> current Voyage topology.

## Installation Issues & Solutions

If you encounter timeout errors while installing dependencies (especially PyTorch), try these solutions:

### Solution 1: Install with Increased Timeout
```powershell
pip install --timeout=1000 -r requirements.txt
```

### Solution 2: Install PyTorch Separately (CPU-only, smaller download)
```powershell
# Install PyTorch CPU version first (much smaller, ~100MB vs 2GB)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Then install other dependencies
pip install fastapi==0.109.0 uvicorn==0.27.0 sentence-transformers==2.2.2
```

### Solution 3: Use Conda (Alternative)
```powershell
# If you have conda installed
conda create -n sbert python=3.10
conda activate sbert
conda install pytorch torchvision cpuonly -c pytorch
pip install fastapi==0.109.0 uvicorn==0.27.0 sentence-transformers==2.2.2
```

### Solution 4: Install from Cache (if partially downloaded)
```powershell
# Clear pip cache and retry
pip cache purge
pip install --no-cache-dir -r requirements.txt
```

## Quick Start (After Successful Installation)

1. **Activate Virtual Environment**
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

2. **Run the Service**
   ```powershell
   uvicorn app:app --reload --port 8000
   ```

3. **Test the Service**
   ```powershell
   # Test health endpoint
   curl http://localhost:8000/health
   
   # Test embedding endpoint
   curl -X POST http://localhost:8000/embed -H "Content-Type: application/json" -d "{\"text\": \"Hello world\"}"
   ```

4. **View Interactive Docs**
   - Open browser: http://localhost:8000/docs

## Troubleshooting

### Port Already in Use
```powershell
# Use a different port
uvicorn app:app --port 8001
```

### Model Download Issues
The SBERT model (~90MB) will be downloaded on first use. Ensure you have:
- Internet connection
- ~200MB free disk space
- Access to huggingface.co

### Virtual Environment Issues
```powershell
# Deactivate current venv
deactivate

# Remove and recreate
Remove-Item -Recurse -Force venv
python -m venv venv
.\venv\Scripts\Activate.ps1
```

## Production Deployment

```powershell
# Run with multiple workers
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4
```

## Environment Variables (Optional)

Create a `.env` file:
```
PORT=8000
LOG_LEVEL=INFO
MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
