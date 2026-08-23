# 🚀 Complete Operating Guide - Topic Similarity MVP

> **Historical SBERT-era local guide — not a current deployment instruction.**
> The supported production/staging topology is Node/Express, PostgreSQL,
> same-origin Nginx frontend, and Voyage `voyage-4-large`; it does not require
> this FastAPI/SBERT service. Use the [Phase 6 deployment runbook](../deployment/deployment-runbook.md)
> and [environment matrix](../deployment/environment-matrix.md) for current operations.

**Date:** February 17, 2026  
**Goal:** Get the entire application running locally from scratch

---

## 📋 Overview

The Topic Similarity MVP consists of **3 services** that must run simultaneously:

1. **SBERT Service** (Python, port 8000) - Semantic embeddings
2. **Backend API** (Node.js, port 3000) - Main API server
3. **Frontend** (React, port 5173) - User interface

**Total setup time:** ~20-30 minutes

---

## ✅ Prerequisites Check

Before starting, verify you have:

```powershell
# Check Node.js (16+ required)
node --version

# Check npm
npm --version

# Check Python (3.8+ required)
python --version

# Check PostgreSQL is running
# (You already have this - Neon cloud database configured)
```

---

## 📁 Current Status

You already have:
- ✅ **Database:** Neon PostgreSQL (cloud-hosted, credentials in .env)
- ✅ **Backend:** Express.js configured (port 3000)
- ✅ **Frontend:** React configured (port 5173)
- ✅ **SBERT Service:** Python FastAPI (port 8000)

**No additional signup needed** - database is already provisioned!

---

## 🎯 Step-by-Step Operating Instructions

### STEP 1: Start SBERT Service (Python) 🐍
**Duration:** 2-3 minutes  
**Terminal:** Open PowerShell #1

```powershell
# Navigate to SBERT service
cd "C:\Users\LENOVO T14\Development\topic-similarity-mvp\sbert-service"

# Activate Python virtual environment
.\venv\Scripts\Activate

# Start the SBERT service
python app.py
```

**Expected output:**
```
INFO:     Started server process [12345]
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Verify it's running:**
```powershell
# In another terminal:
curl http://localhost:8000/health
```

Expected response: `{"status": "OK"}`

⏸️ **Leave this terminal running - don't close it!**

---

### STEP 2: Start Backend API (Node.js) 📦
**Duration:** 2-3 minutes  
**Terminal:** Open PowerShell #2

```powershell
# Navigate to backend
cd "C:\Users\LENOVO T14\Development\topic-similarity-mvp\backend"

# Ensure dependencies are installed
npm install

# Start development server
npm run dev
```

**Expected output:**
```
✨ Server running on port 3000
📊 Connected to database: neondb
🔄 SBERT service available at http://localhost:8000
```

**Verify it's running:**
```powershell
# In another terminal:
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"OK","message":"Server is running","environment":"development","apiVersion":"v1"}
```

⏸️ **Leave this terminal running - don't close it!**

---

### STEP 3: Start Frontend (React) ⚛️
**Duration:** 2-3 minutes  
**Terminal:** Open PowerShell #3

```powershell
# Navigate to frontend
cd "C:\Users\LENOVO T14\Development\topic-similarity-mvp\frontend"

# Ensure dependencies are installed
npm install

# Start dev server
npm run dev
```

**Expected output:**
```
  VITE v5.0.0  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Open the app:**
- Open your browser to `http://localhost:5173`
- You should see the Topic Similarity form

---

## 🧪 Test It Works

### Test 1: Health Checks (All Services Running)

```powershell
# Terminal #4 - Run these to verify:

# SBERT service
curl http://localhost:8000/health
# ✅ Should respond: {"status": "OK"}

# Backend API
curl http://localhost:3000/health
# ✅ Should respond with JSON health info

# Frontend
# ✅ Should be accessible at http://localhost:5173
```

### Test 2: Try the Application

1. **Open** `http://localhost:5173` in your browser
2. **Enter a topic** (at least 7 words):
   ```
   Machine learning applications in healthcare diagnosis systems
   ```
3. **Optionally add keywords:**
   ```
   AI, neural networks, medical diagnosis
   ```
4. **Click** "Check Similarity" button
5. **Wait** for results (2-5 seconds)

**Expected result:**
- ✅ Risk level shown (LOW/MEDIUM/HIGH with color)
- ✅ Algorithm scores displayed (Jaccard, TF-IDF, SBERT)
- ✅ Matching topics shown in results

### Test 3: Check Logs

```powershell
# Backend logs show API calls:
# GET /health
# POST /api/similarity/check

# SBERT logs show embeddings being generated

# Frontend console (F12 in browser) shows API responses
```

---

## 🛠️ Environment Variables Guide

Your `.env` file already has these configured:

### What Each Variable Does

```env
# ========== Server ==========
PORT=3000                              # ✅ Backend port (change if needed)
NODE_ENV=development                   # ✅ Dev mode (logs, no minify)
API_VERSION=v1                         # ✅ API version

# ========== Database ==========
DATABASE_URL="postgresql://neondb_owner:...@...us-east-1.aws.neon.tech/neondb?sslmode=require"
# ✅ Your Neon PostgreSQL connection
# ✅ Already configured - don't change

# ========== SBERT Service ==========
SBERT_SERVICE_URL=http://localhost:8000
# ✅ Where Python SBERT service runs
# ✅ Keep as-is (local development)

SBERT_TIMEOUT=30000
# ✅ How long to wait for SBERT (milliseconds)
# ✅ 30 seconds - increase if getting timeouts

SBERT_RETRY_ATTEMPTS=3
# ✅ How many times to retry if SBERT fails
# ✅ Usually works first try
```

### How to Get/Change Each Variable

| Variable | Current Value | Change If... | How to Find |
|----------|---|---|---|
| `PORT` | 3000 | Port 3000 in use | `netstat -ano \| findstr :3000` |
| `DATABASE_URL` | Neon URL | Need different DB | Contact team/setup new Neon project |
| `SBERT_SERVICE_URL` | localhost:8000 | SBERT on different host | Check what port SBERT uses (in app.py) |
| `SBERT_TIMEOUT` | 30000ms | Getting timeouts | Increase to 40000 or 50000 |
| `SBERT_RETRY_ATTEMPTS` | 3 | Want more retries | Increase to 5 |

---

## 🚨 Troubleshooting

### Issue: "Port 3000 already in use"

```powershell
# Option 1: Kill the process using port 3000
Get-Process | Where-Object { $_.Name -eq "node" } | Stop-Process -Force

# Option 2: Use different port
# Edit backend/.env:
PORT=3001

# Then restart backend
npm run dev
```

### Issue: "Cannot connect to database"

```powershell
# Check connection string in .env is correct:
DATABASE_URL=postgresql://neondb_owner:npg_4QsvndYkKw3G@ep-...

# Verify Neon is accessible:
# 1. Go to https://console.neon.tech
# 2. Check the connection string matches your .env
# 3. Check database is not suspended

# If needed, get new connection string:
# Neon Console → Connection Details → Copy connection string → Update .env
```

### Issue: "SBERT service unavailable"

```powershell
# Check SBERT is running:
curl http://localhost:8000/health

# If not, start it:
cd sbert-service
.\venv\Scripts\Activate
python app.py

# If Python venv not setup:
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
python app.py
```

### Issue: "Frontend won't connect to backend"

```powershell
# Check backend is running:
curl http://localhost:3000/health

# Check frontend .env has correct API URL:
# frontend/.env.local should have:
VITE_API_URL=http://localhost:3000

# Check browser console (F12) for CORS errors
# If CORS issue: backend is rejecting frontend origin
# Check backend .env CORS_ORIGIN setting
```

### Issue: "npm install fails"

```powershell
# Clear cache and retry
cd [backend or frontend]
rm -r node_modules
rm package-lock.json
npm cache clean --force
npm install
```

### Issue: "Tests fail"

```powershell
# Backend tests
cd backend
npm test -- --no-coverage

# Frontend tests
cd frontend
npm test -- --no-coverage

# Clear cache if still failing
npm test -- --clearCache
```

---

## 📊 What to Expect When Running

### Timeline

```
00:00 - Start SBERT service (Python)
        ✅ "Uvicorn running on http://0.0.0.0:8000"

01:00 - Start Backend API (Node.js)
        ✅ "Server running on port 3000"
        ✅ "Connected to database: neondb"
        ✅ "SBERT service available"

02:00 - Start Frontend (React)
        ✅ "Local: http://localhost:5173/"
        ✅ Open browser, see form

03:00 - Application is ready to use! 🎉
```

### What Each Service Does

| Service | Port | What It Does | Terminal |
|---------|------|------------|----------|
| SBERT | 8000 | Generates semantic embeddings (384-dim vectors) | #1 (Python) |
| Backend | 3000 | Main API, coordinates all 3 algorithms | #2 (Node.js) |
| Frontend | 5173 | React UI, form input and results display | #3 (Vite) |

---

## 🔄 Testing the Complete Flow

### Test Case 1: Simple Topic (Low Risk)

```
Topic: Quantum computing applications in modern cryptography research
Keywords: quantum algorithms, encryption, post-quantum

Expected:
✅ Risk Level: LOW (no similar topics in database)
✅ All algorithms show < 50% similarity
✅ Top 5 historical results shown
```

### Test Case 2: Similar to Existing (High Risk)

```
Topic: Machine learning applications in healthcare diagnostics
Keywords: neural networks, medical diagnosis, AI

Expected:
✅ Risk Level: MEDIUM or HIGH (similar topics exist)
✅ Algorithm scores show > 60% similarity
✅ Matching topics listed in results
✅ Warnings if applicable
```

### Test Case 3: Invalid Input (Validation)

```
Topic: Too short

Expected:
✅ Submit button disabled
✅ Red border on input
✅ Error message: "must be at least 7 words"
```

---

## 📝 Key URLs to Remember

```
Frontend:    http://localhost:5173
Backend API: http://localhost:3000
SBERT:       http://localhost:8000
Database:    Via connection string in .env
GitHub:      https://github.com/box129/topic-similarity-detection-mvp
```

---

## ✅ Checklist Before Using

- [ ] Node.js installed (v16+)
- [ ] Python installed (v3.8+)
- [ ] PostgreSQL running (or Neon cloud DB accessible)
- [ ] `.env` file configured (already done)
- [ ] Dependencies installed (`npm install` in backend & frontend)
- [ ] SBERT venv activated
- [ ] All 3 services in separate terminals

---

## 🎯 Quick Start Command Reference

### Open 3 PowerShell terminals and run these:

**Terminal 1 (SBERT):**
```powershell
cd sbert-service; .\venv\Scripts\Activate; python app.py
```

**Terminal 2 (Backend):**
```powershell
cd backend; npm run dev
```

**Terminal 3 (Frontend):**
```powershell
cd frontend; npm run dev
```

**Then:**
```
Open http://localhost:5173 in browser
```

---

## 📞 Getting Help

If something doesn't work:

1. **Check all 3 services are running** (green text, no errors)
2. **Check terminal output** for error messages
3. **Check browser console** (F12 → Console tab) for JavaScript errors
4. **Test each service independently** with curl commands
5. **Check `.env` file** has correct values
6. **Verify database connection** works

---

## 🎉 Success Indicators

When everything works:

1. ✅ **All 3 services running** without errors
2. ✅ **Frontend loads** at http://localhost:5173
3. ✅ **Form appears** with topic input
4. ✅ **Submit button works** and calls backend
5. ✅ **Results appear** within 2-5 seconds
6. ✅ **Risk level** shows with color (LOW/MEDIUM/HIGH)
7. ✅ **Algorithm scores** displayed
8. ✅ **No JavaScript errors** in browser console
9. ✅ **Database queries** working (no connection errors)
10. ✅ **All features functional** (form validation, results display, error handling)

---

**You're ready to operate the application!** 🚀

Start with the 3 terminal commands above and follow the test steps.

If you hit any issues, check the troubleshooting section or review the service logs.

Good luck! 🎊
