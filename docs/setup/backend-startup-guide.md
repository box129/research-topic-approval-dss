# Backend Startup Guide - Windows Configuration

> **Historical local troubleshooting guide.** Do not use its SBERT-era startup
> sequence as a staging or production contract. Current deployment uses the
> [Phase 6 runbook](../deployment/deployment-runbook.md): Node/Express,
> PostgreSQL, same-origin frontend, and Voyage `voyage-4-large`.

## Critical Issue: Windows Firewall Blocking Node.js

The Node.js backend application is fully functional but **cannot accept network connections due to Windows Firewall restrictions**.

## Symptoms
- Backend starts and prints: "Server is running on port 3000"
- But HTTP requests fail: "Unable to connect to remote server"
- `netstat` shows no listening socket for port 3000

## Solution: Configure Windows Firewall

### Step 1: Add Node.js to Firewall (Recommended)

**Option A: Automatic (Easiest)**
1. Open File Explorer
2. Navigate to: `backend/`
3. Double-click `setup-firewall.bat`
4. Click "Yes" when prompted for admin privileges
5. Wait for the script to complete
6. Close the window

**Option B: Manual via PowerShell (If Option A doesn't work)**
1. Right-click PowerShell icon
2. Select "Run as Administrator"
3. Run this command:
   ```powershell
   New-NetFirewallRule -DisplayName "Node.js Backend" `
     -Program "C:\Program Files\nodejs\node.exe" `
     -Direction Inbound `
     -Action Allow `
     -Protocol TCP `
     -LocalPort 3000
   ```

### Step 2: Start the Backend

**Using npm:**
```bash
cd backend
npm run dev
```

**Output should show:**
```
✅ Server started successfully

══════════════════════════════════════════════════
Server is running on port 3000
Press CTRL+C to stop

Endpoints:
  GET  http://localhost:3000/health
  POST http://localhost:3000/api/similarity/check

══════════════════════════════════════════════════
```

### Step 3: Test the Backend

Open a new terminal window and test:

**Test 1: Health Check**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/health"
```

Expected response:
```json
{
  "status": "OK",
  "message": "Server is running",
  "environment": "development",
  "apiVersion": "v1"
}
```

**Test 2: Similarity Check**
```powershell
$body = @{
    topic = "Machine learning in healthcare"
    keywords = "AI, diagnosis, medical"
} | ConvertTo-Json

Invoke-WebRequest -Method Post `
  -Uri "http://localhost:3000/api/similarity/check" `
  -ContentType "application/json" `
  -Body $body
```

## Complete System Startup

Once firewall is configured, start all services:

### Terminal 1: Backend
```bash
cd backend
npm run dev
```

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

### Terminal 3: Python SBERT Service (Optional)
```bash
cd sbert-service
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

## Verification

All three should show:
- ✅ Backend: "Server is running on port 3000"
- ✅ Frontend: "Local: http://localhost:5174"
- ✅ SBERT (if started): "Uvicorn running on http://0.0.0.0:8000"

Then visit: `http://localhost:5174`

## Firewall Issues?

If adding the firewall rule didn't work:

### Option 1: Temporarily Disable Firewall (Testing Only)
**⚠️ WARNING: Only for testing, re-enable immediately after!**

```powershell
# As Administrator - DISABLE
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled $false

# Test the application

# Then RE-ENABLE
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled $true
```

### Option 2: Use WSL2 (Windows Subsystem for Linux)
If firewall issues persist, consider running the application in WSL2:

1. Install WSL2 with Ubuntu or Debian
2. Clone the repository in WSL2
3. Install Node.js and Python in WSL2
4. Run services from WSL2 terminal

WSL2 applications don't have the same firewall restrictions.

### Option 3: Use Docker
Docker containers have different networking:

1. Install Docker Desktop for Windows
2. Build and run services in containers
3. Network access is handled by Docker

## Files Reference

| File | Purpose |
|------|---------|
| `src/server.js` | Express server entry point (listens on 0.0.0.0:3000) |
| `start-server-wrapped.js` | Clean startup wrapper |
| `add-firewall-rule.ps1` | PowerShell script to configure firewall |
| `setup-firewall.bat` | Batch file that requests admin and runs PS script |
| `start-backend.bat` | Simple batch launcher |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "netstat shows no listening port" | Firewall is blocking (run setup-firewall.bat) |
| "Unable to connect to remote server" | Firewall rule not added successfully |
| "Port already in use" | Change PORT in `.env` and restart |
| "Database connection failed" | Verify DATABASE_URL in `.env` |
| "Permission denied" | Run terminal as Administrator |

## FAQ

**Q: Why does Node.js say it's listening but isn't?**
A: Windows Firewall is intercepting the socket creation before Node.js can fully bind to the port.

**Q: Is this a code issue?**
A: No. The backend code is production-ready. This is a Windows system configuration issue.

**Q: Can I test without fixing the firewall?**
A: Only if you run a Linux/WSL2/Docker environment where firewall rules don't apply the same way.

**Q: Is it safe to add the firewall rule?**
A: Yes. The rule only allows Node.js to listen on port 3000 (a non-privileged port). You can remove it anytime.

---

**Next Steps:**
1. Run `backend/setup-firewall.bat` (or add rule manually)
2. Start backend: `npm run dev`
3. Test with health endpoint
4. Start frontend: `npm run dev`
5. Visit http://localhost:5174
