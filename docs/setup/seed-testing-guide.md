# SEED TESTING GUIDE

## Section 1 — Setup & Seeding

### How to run each seed file and in what order

Run the seed files in ascending order of size to build up the dataset incrementally:

1. **seed_100.csv** (100 rows) - Start here for initial testing
   ```bash
   cd backend/prisma
   node seed.js seed_100.csv
   ```

2. **seed_500.csv** (500 rows) - Add more data for richer similarity results
   ```bash
   node seed.js seed_500.csv
   ```

3. **seed_1000.csv** (1000 rows) - Full dataset for comprehensive testing
   ```bash
   node seed.js seed_1000.csv
   ```

### How to verify the data was inserted correctly

After seeding, verify the data with these SQL queries in your PostgreSQL database:

```sql
-- Check total count
SELECT COUNT(*) FROM historical_topics;

-- Check category distribution
SELECT category, COUNT(*) FROM historical_topics GROUP BY category ORDER BY COUNT(*) DESC;

-- Check for duplicates (should return 0 rows)
SELECT title, COUNT(*) FROM historical_topics GROUP BY title HAVING COUNT(*) > 1;

-- Sample some rows
SELECT title, keywords, category FROM historical_topics LIMIT 5;
```

### How to reset/clear the database between test runs

To clear all data between test runs:

```sql
-- Delete all historical_topics
DELETE FROM historical_topics;

-- Reset auto-increment ID (optional)
ALTER SEQUENCE historical_topics_id_seq RESTART WITH 1;
```

Or drop and recreate the database:

```bash
cd backend
npx prisma db push --force-reset
```

## Section 2 — Test Cases

Test each dataset size (100, 500, 1000 rows) with these scenarios. Use the frontend at `http://localhost:5173` or API calls to `/api/similarity/check`.

### An exact match test
**Input:** Copy a title directly from the CSV
- Topic: "Epidemiology of Road Traffic Injuries and Fatalities in Urban Communities of Southwest Nigeria"
- Keywords: "road traffic injuries, fatalities, urban, epidemiology, Southwest"

**Expected Results:**
- **100 rows:** HIGH risk (exact match in Tier 1)
- **500/1000 rows:** HIGH risk (exact match in Tier 1)

### A near match test
**Input:** Slightly reword a title from the CSV
- Topic: "Epidemiology of Road Traffic Accidents and Deaths in Urban Areas of Southwest Nigeria"
- Keywords: "road traffic accidents, deaths, urban areas, epidemiology, Southwest Nigeria"

**Expected Results:**
- **100 rows:** MEDIUM risk (semantic similarity via SBERT)
- **500/1000 rows:** MEDIUM-HIGH risk (better semantic matching with more data)

### A completely unrelated topic test
**Input:** Topic with no relation to public health
- Topic: "Machine Learning Algorithms for Stock Market Prediction"
- Keywords: "machine learning, algorithms, stock market, prediction"

**Expected Results:**
- **All sizes:** LOW risk (no meaningful matches)

### A cross-category test
**Input:** Topic that overlaps Infectious Diseases and Environmental Health
- Topic: "Impact of Environmental Factors on Malaria Transmission in Rural Areas"
- Keywords: "environmental factors, malaria, transmission, rural areas"

**Expected Results:**
- **100 rows:** MEDIUM risk (limited cross-category matches)
- **500/1000 rows:** MEDIUM-HIGH risk (richer cross-category connections)

## Section 3 — Known Algorithm Limitations

### Jaccard
Very fast but inaccurate with synonyms. Common words in Nigerian public health topics ("assessment", "study", "Nigeria", "Osun") appear across most titles and will artificially inflate similarity scores between unrelated topics.

### TF-IDF
Reliable at 100–500 rows but response time increases at 1000 rows (expect 2–5 seconds). Since all topics are public health domain, rare words lose discriminating power, reducing accuracy.

### SBERT
Most semantically accurate but slowest. Expected response times: ~instant at 100 rows, 3–8 seconds at 500 rows, 10–20 seconds at 1000 rows on CPU-only hardware (no GPU). First request after service start is always slower due to model loading into memory.

### pgvector
Vector similarity search only works for rows that have embeddings. CSV-imported seed data has no embeddings — the system will fall back to text matching for those rows silently.

### 60% threshold
With only 100 rows in the database, Tier 2 and Tier 3 matches may be sparse or empty. Results become richer and more representative at 500–1000 rows.

### Cold start
All three services (backend, SBERT, frontend) must be running simultaneously for full accuracy. SBERT degradation is silent — results appear normal but are less accurate.

## Section 4 — Browser Testing Guide

### Step 1: Start All Three Services

Open three separate PowerShell terminals and start each service in this order:

**Terminal 1 - Backend (Port 3000)**
```powershell
cd backend
npm run dev
```
Wait for: `Express server running at http://localhost:3000`

**Terminal 2 - SBERT Service (Port 8000)**
```powershell
cd sbert-service
.\venv\Scripts\Activate.ps1
python app.py
```
Wait for: `Uvicorn running on http://0.0.0.0:8000`

**Terminal 3 - Frontend (Port 5173)**
```powershell
cd frontend
npm run dev
```
Wait for: `Local: http://localhost:5173`

### Step 2: Verify Services Are Running

In a new terminal, test the health of each:

```powershell
# Test backend
Invoke-WebRequest -Uri http://localhost:3000/health -Method GET

# Test SBERT
Invoke-WebRequest -Uri http://localhost:8000/docs -Method GET

# Both should return 200 OK
```

### Step 3: Access the Frontend in Browser

Open your browser and go to:
```
http://localhost:5173
```

You should see a form with:
- **Topic** input field (required)
- **Keywords** input field (optional)
- **Category** dropdown (optional)
- **Submit** button
- **Results panel** (appears after submission)

### Step 4: Seed the Database

First, seed some data for meaningful results:

```powershell
cd backend/prisma
node seed.js seed_100.csv
```

Wait for: `Seeding complete. Inserted: 80, Skipped: 0`

### Step 5: Test with Your Input

Try your earlier example in the form:

**Topic field:**
```
Malaria control in swampy damp rural and urban environmen with everyday rainfall
```

**Keywords field (optional):**
```
malaria, environment, rainfall, breeding sites
```

**Category field (optional):**
```
Environmental Health
```

Click **Submit**.

### Step 6: Understand the Results Display

The response will show:

```
RISK LEVEL: ⚠️ MEDIUM-HIGH  (or MEDIUM/LOW based on scores)

Maximum Similarity Score: 0.68

--- TIER 1: Historical Topics (Top 5) ---
1. Vector Breeding Site Assessment and Malaria Risk...
   Score: 0.68 | Category: Environmental Health

2. Factors Influencing Insecticide-Treated Net Use...
   Score: 0.64 | Category: Infectious Diseases

... (3-5 results)

--- TIER 2: Current Session Topics (≥ 0.60) ---
(Empty if no current session data)

--- TIER 3: Under Review (≥ 0.60, last 48 hours) ---
(Empty if no under-review data)
```

### Step 7: Try Different Test Cases

### **Test Case 1: Exact Match (Should be HIGH risk)**
```
Topic: Epidemiology of Road Traffic Injuries and Fatalities in Urban Communities of Southwest Nigeria
Keywords: road traffic injuries, fatalities, urban, epidemiology, Southwest
Category: Epidemiology
```

**Expected:** HIGH risk (will match exactly from seeded data)

---

### **Test Case 2: Unrelated Topic (Should be LOW risk)**
```
Topic: Machine Learning Algorithms for Stock Market Prediction
Keywords: machine learning, algorithms, stock market, prediction
Category: (leave empty)
```

**Expected:** LOW risk (no matching in public health domain)

---

### **Test Case 3: Near Match (Should be MEDIUM risk)**
```
Topic: Assessment of Malaria Prevention Strategies in Rural Communities
Keywords: malaria, prevention, rural, strategies, communities
Category: Infectious Diseases
```

**Expected:** MEDIUM risk (similar concepts but different wording)

---

### **Test Case 4: Cross-Category Match**
```
Topic: Impact of Environmental Factors on Malaria Transmission
Keywords: environmental factors, malaria, transmission
Category: Environmental Health
```

**Expected:** MEDIUM-HIGH risk (matches across categories)

### Step 8: Monitor Backend Console

Watch the backend terminal for logs like:

```
[INFO] POST /api/similarity/check
[INFO] Topic: "Malaria control..."
[INFO] Running Jaccard search: 234ms
[INFO] Running TF-IDF search: 456ms
[INFO] Running SBERT search: 5234ms
[INFO] Max similarity: 68
[INFO] Risk level: MEDIUM
[INFO] Response time: 5924ms
```

### Step 9: Check for Issues

### **If results appear very fast (< 500ms):**
- SBERT likely timed out or failed
- Backend fell back to TF-IDF + Jaccard only
- Results are less accurate but still functional
- Check SBERT terminal for errors

### **If SBERT is slow (10+ seconds):**
- Normal on first request (model loads into memory)
- Subsequent requests will be faster
- This is expected on CPU-only hardware

### **If you get "Connection refused":**
- Make sure all 3 services are running
- Check firewall rules (especially on Windows)
- Verify ports: 3000, 8000, 5173 are not blocked

### **If frontend shows blank page:**
- Check browser console (F12) for JavaScript errors
- Hard refresh: Ctrl+Shift+R
- Rebuild frontend: `cd frontend && npm run build`

### **If you get "RESEARCH_CATEGORIES is not defined":**
- Frontend code was missing constants
- Should be fixed in current version

### Step 10: Debug Mode

For detailed debugging, check these endpoints:

```powershell
# Backend health
Invoke-WebRequest -Uri http://localhost:3000/health -Method GET

# SBERT health
Invoke-WebRequest -Uri http://localhost:8000/docs -Method GET

# Test API directly
Invoke-WebRequest -Uri http://localhost:3000/api/similarity/check -Method POST -Body '{"topic": "test topic"}' -ContentType 'application/json'
```

### Quick Reference: What Each Icon Means

| Icon | Risk Level | Score Range | Meaning |
|------|-----------|---|---------|
| 🟢 | LOW | < 50 | No concerning similarity |
| 🟡 | MEDIUM | 50-69 | Some overlap, review recommended |
| 🔴 | HIGH | >= 70 | High similarity, flag for originality check |

---

**Start the services now, then let me know if you hit any issues!** 🚀