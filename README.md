# Topic Similarity MVP 🎓

A **tri-algorithm topic similarity detection system** for university research submissions. Detects duplicate or overly similar topics across submissions using machine learning and NLP techniques.

![Tests Passing](https://img.shields.io/badge/tests-284%2F284%20passing-brightgreen) ![Coverage](https://img.shields.io/badge/coverage-90%25+-brightgreen) ![Status](https://img.shields.io/badge/status-Production%20Ready-blue) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features

- 🔍 **Three-Algorithm Comparison**
  - Jaccard similarity (fast, exact matching)
  - TF-IDF scoring (term importance analysis)
  - SBERT embeddings (semantic understanding)

- 📊 **Three-Tier Result Filtering**
  - Tier 1: Historical submissions (top 5)
  - Tier 2: Current session matches (≥60%)
  - Tier 3: Under review (≥60%, last 48 hours)

- ⚠️ **Risk-Level Assessment**
  - `LOW` (✅ safe to proceed)
  - `MEDIUM` (⚠️ review required)
  - `HIGH` (🛑 likely duplicate)

- 💪 **Production-Ready**
  - Graceful degradation when services fail
  - 10-second timeout protection
  - Comprehensive error handling
  - Memory leak prevention

---

## 🏗️ Tech Stack

### Backend
- **Node.js + Express.js** - REST API server
- **Prisma ORM** - Type-safe database access
- **PostgreSQL + pgvector** - Vector-based semantic search
- **Jest** - Unit & integration testing
- **Winston** - Structured logging

### Frontend
- **React 18** - UI library
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **Axios** - HTTP client
- **Vitest** - Component testing

### SBERT Service
- **FastAPI** - Python API framework
- **sentence-transformers** - Semantic embeddings
- **Docker** - Containerization

### Database
- **PostgreSQL 15+** - Relational data
- **pgvector extension** - Vector similarity search

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ & npm
- PostgreSQL 15+ with pgvector
- Python 3.8+ (for SBERT service)
- Git

### 1️⃣ Clone & Setup

```bash
git clone https://github.com/yourusername/topic-similarity-mvp.git
cd topic-similarity-mvp
```

### 2️⃣ Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials

# Setup database
npm run prisma:generate
npm run prisma:push

# Start development server (port 3000)
npm run dev
```

**Environment Variables Required:**
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/topic_similarity
SBERT_SERVICE_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:5173
SBERT_TIMEOUT=5000
```

### 3️⃣ SBERT Service Setup

```bash
cd ../sbert-service
python -m venv venv
./venv/Scripts/Activate  # Windows
source venv/bin/activate # Mac/Linux

pip install -r requirements.txt
python app.py
```

Service runs on `http://localhost:8000`

### 4️⃣ Frontend Setup

```bash
cd ../frontend
npm install
npm run dev
```

App available at `http://localhost:5173`

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test                 # Run all tests
npm run test:coverage   # Generate coverage report
npm run test:watch      # Watch mode (auto-rerun)
```

**Results:** ✅ 210/210 tests passing (88.73% coverage)

### Frontend Tests
```bash
cd frontend
npm test                 # Run all tests
npm run test:coverage   # Generate coverage report
npm run test:watch      # Watch mode
```

**Results:** ✅ 74/74 tests passing (95.39% coverage)

---

## 📚 Documentation

- **[Backend Setup Guide](backend/README.md)** - Detailed backend configuration
- **[Frontend Setup Guide](frontend/README.md)** - Frontend development guide
- **[API Documentation](docs/api/backend-api.md)** - Complete endpoint reference
- **[Architecture Overview](docs/architecture/overview.md)** - System design & patterns
- **[Code Quality Report](docs/archive/audits/code-quality-audit.md)** - Code review findings

---

## 📁 Project Structure

```
topic-similarity-mvp/
├── backend/                    # Express.js API (port 3000)
│   ├── src/
│   │   ├── controllers/       # Route handlers
│   │   ├── services/          # Algorithm implementations
│   │   ├── middleware/        # Express middleware
│   │   ├── config/            # Configuration
│   │   └── server.js          # App entry point
│   ├── prisma/                # Database schema
│   ├── tests/                 # Test suites
│   └── package.json
│
├── frontend/                   # React + Vite (port 5173)
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── App.jsx            # Root component
│   │   └── main.jsx           # Entry point
│   ├── tests/                 # Vitest suites
│   └── package.json
│
├── sbert-service/             # FastAPI service (port 8000)
│   ├── app.py                 # FastAPI app
│   ├── requirements.txt        # Python dependencies
│   └── Dockerfile             # Container config
│
└── docs/                       # Additional documentation
```

---

## 🔌 API Overview

### Core Endpoint: Check Similarity

```bash
POST /api/similarity/check
Content-Type: application/json

{
  "topic": "Machine Learning in Healthcare",
  "keywords": "neural networks, diagnosis, AI"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "overall_risk": "HIGH",
    "max_similarity": 88,
    "tier1_historical": [
      {
        "title": "Deep Learning for Medical Imaging",
        "jaccard": 65.3,
        "tfidf": 72.1,
        "sbert": 88.0
      }
    ],
    "tier2_current": [],
    "tier3_under_review": [],
    "recommendation": "High similarity detected."
  }
}
```
[Full API Documentation →](docs/api/backend-api.md)

---

## 🎯 Algorithm Details

### Jaccard Similarity
- **Speed:** ⚡ Very fast
- **Accuracy:** ⭐⭐⭐ Good for exact matches
- **How:** Calculates overlap between word sets
- **Role:** Lexical overlap signal

### TF-IDF Scoring
- **Speed:** ⚡ Very fast
- **Accuracy:** ⭐⭐⭐ Good for term importance
- **How:** Measures term frequency & document importance
- **Role:** Weighted lexical signal

### SBERT Embeddings
- **Speed:** ⏱️ Slower (semantic processing)
- **Accuracy:** ⭐⭐⭐⭐⭐ Best semantic understanding
- **How:** Generates 384-dim vectors, compares cosine similarity
- **Role:** Semantic/paraphrase signal when available
- **Fallback:** Auto-disables if service unavailable

---

## ⚙️ Configuration

### Risk Level Thresholds

| Condition | Risk Level | Action |
|-----------|-----------|--------|
| Highest similarity >= 70% | HIGH | Review before proceeding |
| Highest similarity >= 50% | MEDIUM | Manual review |
| Highest similarity < 50% | LOW | Low duplication risk |

### Database Tables

Three tables with identical schemas:

| Table | Purpose | Queried |
|-------|---------|---------|
| `historical_topics` | Archive submissions | Always (top 5) |
| `current_session_topics` | Active semester | If ≥60% match |
| `under_review_topics` | Recent submissions | If ≥60% match (48h window) |

All store 384-dimensional SBERT embeddings for fast similarity search.

---

## 🔒 Security Features

✅ Input sanitization (XSS prevention)  
✅ SQL injection prevention via Prisma  
✅ Rate limiting (Express middleware)  
✅ CORS protection  
✅ Helmet security headers  
✅ Error message sanitization (no secrets leaked)

---

## 🚨 Error Handling

### Graceful Degradation

If SBERT service is unavailable:
1. System continues with Jaccard + TF-IDF
2. Score calculated using available algorithms
3. User sees warning: "SBERT service unavailable"
4. Risk level still calculated accurately

### Timeout Protection

- Database queries: 10-second timeout
- SBERT service: 5-second timeout
- All async operations properly cleaned up

---

## 📈 Performance

| Metric | Value | Target |
|--------|-------|--------|
| API response time | <2s (avg) | <3s |
| SBERT timeout | 5s max | Handle gracefully ✅ |
| Memory usage | Stable | No leaks ✅ |
| Test coverage | 90%+ | 70%+ threshold ✅ |
| Uptime (test) | 100% | 99.9% target ✅ |

---

## 🐛 Troubleshooting

### SBERT Service Won't Start
```bash
cd sbert-service
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\Activate on Windows
pip install --upgrade -r requirements.txt
python app.py
```

### Database Connection Error
```bash
cd backend
# Check DATABASE_URL in .env
npm run prisma:studio  # Visual DB editor
npm run prisma:push    # Sync schema
```

### Frontend Won't Start
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Tests Failing
```bash
# Backend
cd backend && npm test -- --no-coverage

# Frontend
cd frontend && npm test -- --no-coverage

# Check for port conflicts:
# Backend: 3000, Frontend: 5173, SBERT: 8000
```

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and add tests
3. Ensure all tests pass: `npm test`
4. Commit: `git commit -m "feat: add my feature"`
5. Push: `git push origin feature/my-feature`
6. Create Pull Request

**Code Quality Standards:**
- Test coverage ≥ 70%
- All tests passing
- No linting errors
- Clear commit messages

---

## 📋 Checklist for Deployment

- [ ] All tests passing (backend + frontend)
- [ ] Environment variables configured
- [ ] Database schema synced with `npm run prisma:push`
- [ ] SBERT service running
- [ ] Frontend builds without errors
- [ ] API responds to health check
- [ ] Similarity endpoint tested manually
- [ ] Error scenarios tested
- [ ] Performance acceptable (<3s responses)
- [ ] Logs configured and checked

---

## 📜 License

MIT License - see LICENSE file

---

## 📞 Support

- **Issues:** Open a GitHub issue
- **Documentation:** Check the [docs folder](docs/)
- **Questions:** See [FAQ section](#faq)

---

## 🏆 Project Status

- ✅ Core algorithms implemented & tested
- ✅ Frontend UI complete
- ✅ Database schema finalized
- ✅ Error handling comprehensive
- ✅ Code quality audit completed
- ✅ Security review passed
- ✅ Ready for production deployment

**Latest Version:** v0.13.0  
**Last Updated:** February 16, 2026

---

## 🔗 Quick Links

| Resource | Link |
|----------|------|
| API Docs | [docs/api/backend-api.md](docs/api/backend-api.md) |
| Backend Setup | [backend/README.md](backend/README.md) |
| Frontend Setup | [frontend/README.md](frontend/README.md) |
| Architecture | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Code Audit | [docs/archive/audits/code-quality-audit.md](docs/archive/audits/code-quality-audit.md) |
| Test Results | [docs/archive/backend/complete-test-suite-summary.md](docs/archive/backend/complete-test-suite-summary.md) |
