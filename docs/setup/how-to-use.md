# 🎯 INSTRUCTIONS - How to Use the Topic Similarity MVP

> **Historical SBERT-era usage guide.** Current protected direct similarity
> uses Voyage `voyage-4-large` and fails closed when the provider is
> unavailable; it has no SBERT/Jaccard/TF-IDF fallback. Consult the
> [current direct-similarity contract](../api/direct-similarity-security-contract.md)
> and [Phase 6 deployment runbook](../deployment/deployment-runbook.md).

## ✅ Application Status

**All Services Running:**
- ✅ Frontend: http://localhost:5173 (React + Vite)
- ✅ Backend API: http://localhost:3000 (Express.js)
- ⏳ SBERT Service: http://localhost:8000 (Python, loading ML model)

---

## 🚀 STEP 1: Open the Application

Open your web browser and go to:

```
http://localhost:5173
```

You'll see a clean form with three fields:
1. **Topic** - Your research topic title
2. **Keywords** - Comma-separated keywords (optional)
3. **Submit Button** - Click to analyze

---

## 📝 STEP 2: Enter Your Topic

### Example 1 - Healthcare
```
Topic:    Machine learning for disease diagnosis in healthcare
Keywords: neural networks, medical AI, diagnosis, prediction
```

### Example 2 - Education
```
Topic:    AI-powered personalized learning systems for students
Keywords: machine learning, adaptive learning, student modeling
```

### Example 3 - Finance
```
Topic:    Blockchain for secure financial transactions and payments
Keywords: cryptocurrency, distributed ledger, security
```

### Example 4 - IoT
```
Topic:    Internet of Things security in smart home systems
Keywords: sensors, encryption, wireless networks
```

---

## 🔍 STEP 3: Click "Check Similarity"

The system will:
1. Validate your input
2. Query the database (PostgreSQL)
3. Run 3 algorithms in parallel (Jaccard, TF-IDF, SBERT)
4. Calculate similarity scores
5. Determine risk level
6. Return results with 3 tiers

**Expected response time:** 500ms - 2 seconds

---

## 📊 STEP 4: Review Your Results

### Risk Level Badge
The result shows a **Risk Level**:

```
🟢 LOW    → Green background, safe to proceed
🟡 MEDIUM → Yellow background, review carefully
🔴 HIGH   → Red background, high duplication risk
```

### Three Tiers of Results

#### **Tier 1: Historical Topics (Top 5)**
- Shows the 5 most similar topics from your entire history
- **Always displayed**, sorted by similarity %
- Example:
  ```
  1. "Deep learning for disease detection" - 92%
  2. "Machine learning in healthcare" - 87%
  3. "Neural networks for diagnosis" - 81%
  ```

#### **Tier 2: Current Session (≥60%)**
- Topics from current semester with ≥60% similarity
- **Yellow flag** - moderate concern
- Only shown if there are matches
- Example:
  ```
  1. "AI diagnosis systems" - 68%
  ```

#### **Tier 3: Under Review (≥60%)**
- Topics currently under review (last 48 hours)
- **Red flag** - high concern, likely duplicate
- Only shown if there are matches
- Example:
  ```
  1. "Medical AI prediction model" - 75%
  ```

### Algorithm Breakdown

You'll see scores from 3 algorithms:

| Algorithm | What It Does |
|-----------|--------------|
| **Jaccard** | Keyword overlap analysis |
| **TF-IDF** | Term importance weighting |
| **SBERT** | Semantic understanding when available |

The current production API returns separate public Jaccard, TF-IDF, and SBERT scores. It does not expose a public combined score in the normal success response.

---

## 🚨 UNDERSTANDING RISK LEVELS

### Risk Calculation Rules

```
IF   max similarity >= 70%
THEN risk = HIGH 🔴

ELSE IF  max similarity >= 50%
THEN risk = MEDIUM 🟡

ELSE risk = LOW 🟢
```

### What Each Risk Level Means

**🟢 LOW Risk**
- Your topic is unique
- No significant duplicates found
- Safe to submit

**🟡 MEDIUM Risk**
- Some similarity to existing topics
- Review Tier 2 results carefully
- Consider minor modifications if needed

**🔴 HIGH Risk**
- Very similar to existing topics
- Tier 3 matches found (under review)
- Strongly recommend revising your topic

---

## 💡 Tips for Best Results

### ✅ DO THIS:

1. **Use clear, specific topic names**
   - ✅ Good: "Machine learning for disease diagnosis in healthcare"
   - ❌ Poor: "ML stuff"

2. **Include relevant keywords**
   - ✅ Good: "neural networks, medical AI, diagnosis, prediction"
   - ❌ Poor: Empty (less accurate analysis)

3. **Review all tier results**
   - Even with LOW risk, see what similar topics exist
   - Learn from existing work

4. **Trust the system**
   - If flagged HIGH, your topic is too similar
   - Revise and resubmit

### ❌ DON'T DO THIS:

1. ❌ Submit topics with fewer than 7 words (minimum required)
2. ❌ Use unusual spelling or abbreviations
3. ❌ Ignore HIGH risk warnings
4. ❌ Submit similar topics when flagged

---

## 🧪 Testing Examples

Try these topics to see how the system works:

### Medical/Healthcare
```
Topic:    "Deep learning for medical image segmentation analysis"
Keywords: "CNN, radiology, computer vision, healthcare"
```

### Technology
```
Topic:    "Internet of Things security architecture and implementation"
Keywords: "Internet of Things, encryption, wireless, security"
```

### Education
```
Topic:    "Adaptive learning systems using machine learning technologies"
Keywords: "personalization, student modeling, AI, education"
```

### Finance
```
Topic:    "Cryptocurrency price prediction using artificial intelligence techniques"
Keywords: "blockchain, neural networks, forecasting, digital currency"
```

---

## 🔌 API Usage (For Developers)

### Test Directly with PowerShell

```powershell
# Create your request
$body = @{
    topic    = "Your research topic"
    keywords = "keyword1, keyword2, keyword3"
} | ConvertTo-Json

# Send to API
$response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/similarity/check" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

# View results
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Test with curl

```bash
curl -X POST "http://localhost:3000/api/similarity/check" \
    -H "Content-Type: application/json" \
    -d '{
        "topic": "Your topic here",
        "keywords": "keyword1, keyword2"
    }'
```

---

## 📈 Sample Response

**Request:**
```json
{
  "topic": "Machine learning for disease diagnosis in healthcare",
  "keywords": "neural networks, medical AI, healthcare"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "overall_risk": "MEDIUM",
    "max_similarity": 68,
    "tier1_historical": [
      {
        "title": "Similar historical topic",
        "jaccard": 62,
        "tfidf": 75,
        "sbert": 70
      }
    ],
    "tier2_current": [],
    "tier3_under_review": [],
    "recommendation": "Review similar topics before proceeding."
  }
}
```

---

## ⚡ Performance Notes

| Metric | Time |
|--------|------|
| Page Load | <1 second |
| API Response (2 algorithms) | <500ms |
| API Response (3 algorithms) | <2 seconds |
| SBERT First Load | 30-60 seconds |

**Note:** SBERT (semantic AI) takes longer on first run as it downloads the ML model. On subsequent requests, it's much faster (cached).

---

## 🎓 What Happens Behind the Scenes

```
You Submit Topic
       ↓
Frontend validates input
       ↓
Sends POST to Backend API
       ↓
Backend queries 3 tables in PostgreSQL:
  • Historical topics (all)
  • Current session (active semester)
  • Under review (last 48 hours)
       ↓
Runs 3 algorithms in parallel:
  • Jaccard - keyword matching
  • TF-IDF - term importance
  • SBERT - semantic AI (if ready)
       ↓
Returns separate public algorithm scores
       ↓
Calculates risk level
       ↓
Formats results in 3 tiers
       ↓
Returns JSON response
       ↓
Frontend displays results with styling
```

---

## ❓ Frequently Asked Questions

### Q: What if SBERT is still loading?
**A:** The system automatically falls back to Jaccard + TF-IDF. You'll get results instantly with a note saying "SBERT unavailable". Still 90% accurate!

### Q: How long does SBERT take to load?
**A:** First time: 30-60 seconds (downloading ML model). After that: cached, so instant.

### Q: What if I don't see Tier 2 or 3 results?
**A:** This is normal! It means no matches were found at ≥60% similarity for current session (Tier 2) or under review (Tier 3) topics.

### Q: Can I test the API directly?
**A:** Yes! Use PowerShell or curl examples above. The backend accepts JSON POST requests.

### Q: What's the difference between the 3 algorithms?
- **Jaccard:** Quick keyword matching
- **TF-IDF:** Smart term weighting
- **SBERT:** Deep semantic understanding when available

### Q: Why is my topic flagged HIGH?
**A:** The highest public similarity score reaches the HIGH-risk threshold, or an under-review match needs attention. Consider revising your topic.

### Q: How are results sorted?
**A:** By similarity percentage, highest first. Most similar topics appear at the top.

---

## 🚀 You're Ready!

Open your browser and visit:
```
http://localhost:5173
```

Try submitting a topic and see how it works!

If you have any questions, check:
- **docs/setup/user-guide.md** - Complete manual
- **docs/setup/quick-start.md** - Quick reference
- **docs/archive/system-documentation.md** - Technical details

---

**Questions?** Check the documentation files or test the API directly!

**Enjoy using the Topic Similarity MVP! 🎉**
