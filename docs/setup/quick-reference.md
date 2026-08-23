# Quick Reference - Topic Similarity MVP

> **Historical SBERT-era local reference.** It is not a supported staging or
> production startup sequence. The current deployment uses Voyage from the
> Node backend, without a required Python/FastAPI service; use the
> [Phase 6 deployment runbook](../deployment/deployment-runbook.md) instead.

## 🚀 Quick Start (3 Steps)

### Step 1: Start Backend
```powershell
cd backend
npm run dev
```
✅ Runs on port 3000

### Step 2: Start SBERT Service
```powershell
# As background job (recommended for stability)
Start-Job -ScriptBlock {
  cd sbert-service
  .\venv\Scripts\python.exe -u app.py
} -Name "SBERT"

# OR directly
cd sbert-service
.\venv\Scripts\python.exe -u app.py
```
✅ Runs on port 8000

### Step 3: Start Frontend
```powershell
cd frontend
npm run dev
```
✅ Runs on port 5173

---

## 📍 Service Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:5173 | Web interface |
| **API Health** | http://localhost:3000/health | API status check |
| **Similarity Check** | http://localhost:3000/api/similarity/check | Main API endpoint |
| **SBERT Health** | http://localhost:8000/health | SBERT service status |
| **SBERT Embed** | http://localhost:8000/embed | Generate embeddings |

---

## 🔬 Testing the System

### Simple Health Check
```powershell
curl http://localhost:3000/health
```

### Test Similarity API
```powershell
$body = @{
  topic = "Machine learning for disease diagnosis in healthcare"
  keywords = "neural networks, medical AI, diagnosis"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/similarity/check" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### Test SBERT Directly
```powershell
$body = '{"text":"Machine learning for healthcare"}'

Invoke-WebRequest -Uri "http://localhost:8000/embed" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

---

## ✅ Verification Checklist

Before declaring system ready:
- [ ] Backend running on port 3000
- [ ] SBERT service running on port 8000
- [ ] Frontend accessible on port 5173
- [ ] Health checks passing
- [ ] API returns all 3 algorithms enabled
- [ ] Risk level calculation working
- [ ] Database connectivity confirmed

**Expected Response Pattern:**
```json
{
  "status": "success",
  "data": {
    "overall_risk": "LOW|MEDIUM|HIGH",
    "max_similarity": 0,
    "tier1_historical": [],
    "tier2_current": [],
    "tier3_under_review": [],
    "recommendation": "..."
  }
}
```

---

## 🐛 Troubleshooting

### SBERT Not Responding
**Symptom:** `algorithmStatus.sbert: false`

**Solution:**
1. Kill any running Python processes: `Get-Process python | Stop-Process -Force`
2. Restart SBERT as background job
3. Wait 3-4 seconds for startup

### API Timeout
**Symptom:** Request times out or hangs

**Solution:**
- Increase timeout to 30 seconds: `-TimeoutSec 30`
- Check backend logs for errors
- Verify database connectivity

### Port Already in Use
**Symptom:** "Address already in use"

**Solution:**
```powershell
# Find process using port
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

# Kill process
Stop-Process -Id <PID> -Force
```

---

## 📊 System Status Indicators

| Component | Healthy | Degraded | Failed |
|-----------|---------|----------|--------|
| **Frontend** | Loads page | Loads slow | 500 error |
| **Backend** | Responds <100ms | Responds 100-500ms | No response |
| **SBERT** | All 3 algorithms | 2 algorithms | API-only fallback |
| **Database** | All queries fast | Queries slow | Connection error |

---

## 📈 Expected Performance

| Operation | Time |
|-----------|------|
| Health check | <10ms |
| SBERT embedding | <10ms |
| Single algorithm calc | <5ms |
| Full similarity check | 1000-1500ms |

---

## 🔑 Key Files

| File | Purpose |
|------|---------|
| `backend/src/controllers/similarity.controller.js` | Main API logic |
| `backend/src/services/sbert.service.js` | SBERT integration |
| `sbert-service/app.py` | SBERT microservice |
| `frontend/src/pages/SubmitTopic.jsx` | Form component |
| `docs/setup/how-to-use.md` | User documentation |

---

## 🎯 Common Tasks

### Run All Tests
```powershell
cd backend
npm test

cd ../frontend
npm test
```

### View Logs
```powershell
# Backend logs - in terminal where npm run dev is running
# SBERT logs - in terminal or check PowerShell job output

Get-Job | Receive-Job  # View background job output
```

### Stop All Services
```powershell
# Kill backend and SBERT processes
Get-Process node | Stop-Process -Force
Get-Process python | Stop-Process -Force
```

---

## ✨ Features Implemented

✅ Three-algorithm similarity detection  
✅ Graceful degradation (works even if SBERT fails)  
✅ Risk-level assessment (LOW/MEDIUM/HIGH)  
✅ Topic word count validation (minimum 7 words)  
✅ Database integration (3 topic tables)  
✅ RESTful API with comprehensive error handling  
✅ React frontend with real-time results  
✅ 284 unit tests with 84% code coverage  
✅ Complete documentation  

---

## 📚 Documentation Files

- **README.md** - Project overview
- **docs/setup/how-to-use.md** - User guide with examples
- **docs/api/backend-api.md** - API specification
- **docs/archive/status-reports/system-verification-report.md** - Detailed test results
- **docs/archive/status-reports/session-summary.md** - Development notes
- **docs/setup/backend-startup-guide.md** - Setup instructions
- **docs/setup/user-guide.md** - End-user documentation

---

**Last Updated:** February 17, 2026  
**Status:** ✅ Production Ready
