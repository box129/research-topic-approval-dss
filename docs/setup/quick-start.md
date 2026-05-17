# 🚀 Quick Start - Topic Similarity MVP

## ✅ Services Running

```
✅ Frontend:  http://localhost:5173  (React + Vite)
✅ Backend:   http://localhost:3000  (Express API)
⏳ SBERT:     http://localhost:8000  (Python, initializing)
```

---

## 🎯 How to Use (5 Steps)

### 1️⃣ Open the Application
👉 **Visit: http://localhost:5173**

### 2️⃣ Enter Your Topic
Fill in the form:
```
Topic:    "Machine learning in healthcare"
Keywords: "AI, medical, diagnosis"
```

### 3️⃣ Click "Check Similarity"
System will analyze your topic against:
- 📊 Historical topics (top 5)
- 🔄 Current session topics (≥60% match)
- ⚠️ Under review topics (last 48 hours)

### 4️⃣ Review Risk Level
```
🟢 LOW      → Safe, minimal duplication
🟡 MEDIUM   → Check results carefully
🔴 HIGH     → High risk, consider revising
```

### 5️⃣ View Results
See all 3 tiers with:
- Similarity scores (%)
- Algorithm breakdown
- Matched topic titles
- Source information

---

## 📊 Understanding Results

**Current Public Scoring Contract:**

The production API returns separate Jaccard, TF-IDF, and SBERT percentage-style scores. It does not expose a public combined score in the normal success response. See [Backend API](../api/backend-api.md) for the current response shape.

**Risk Decision:**
```
≥70% OR Under-Review Match  → HIGH 🔴
≥50% OR Current-Session     → MEDIUM 🟡
< 50%                        → LOW 🟢
```

---

## 🔧 Test the API Directly

### Health Check
```powershell
Invoke-WebRequest http://localhost:3000/health
```

### Submit a Topic
```powershell
$body = '{"topic":"Your topic","keywords":"keyword1,keyword2"}'
Invoke-WebRequest -Uri "http://localhost:3000/api/similarity/check" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

---

## 📝 Example Topics to Try

| Topic | Keywords | Expected Risk |
|-------|----------|---|
| Deep learning for medical imaging | neural networks, radiology, CNN | Depends on DB |
| Blockchain in finance | cryptocurrency, security, ledger | Depends on DB |
| NLP for chatbots | natural language, conversational AI | Depends on DB |
| IoT in smart cities | sensors, internet of things, connectivity | Depends on DB |

---

## ⚙️ System Architecture

```
Frontend (5173)
     ↓ POST /api/similarity/check
Backend (3000)
     ↓ queries 3 tables + runs 3 algorithms
PostgreSQL (Neon)
     ↑ 
  3 Algorithms:
  • Jaccard (keyword overlap)
  • TF-IDF (term importance)
  • SBERT (semantic understanding)
```

---

## ⏱️ Timing

| Component | Time |
|-----------|------|
| Frontend Load | <1s |
| API Response (no SBERT) | <500ms |
| API Response (with SBERT) | <2s |
| SBERT First Load | 30-60s |

---

## 🚨 Common Issues

| Issue | Fix |
|-------|-----|
| Page won't load | Restart services |
| Backend error | Check Windows Firewall |
| No results | Database might be empty |
| SBERT timeout | Normal - falls back to 2 algorithms |
| Slow response | SBERT still loading model |

---

## 📋 Checklist Before Using

- [ ] Frontend loads at :5173
- [ ] Backend responds to :3000/health
- [ ] Can submit a topic
- [ ] Receive results with risk level
- [ ] No browser console errors

---

## 🎓 What the System Does

**Input:** Your research topic + keywords

**Process:**
1. Validates input
2. Queries all 3 topic databases
3. Runs 3 similarity algorithms in parallel
4. Returns separate public algorithm scores
5. Calculates risk level
6. Formats 3-tier results

**Output:** Risk level (LOW/MEDIUM/HIGH) + all matching topics organized by tier

---

## 💡 Tips for Best Results

✅ Use clear, descriptive topic names
✅ Include relevant keywords
✅ Review Tier 2 & 3 results carefully
✅ Wait for SBERT to fully load (first time only)
✅ Check topic before publishing

---

**Ready to use? → http://localhost:5173**

