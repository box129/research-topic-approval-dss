# Topic Similarity Backend API 🚀

Express.js REST API service for topic similarity detection using three machine learning algorithms.

![Tests](https://img.shields.io/badge/tests-210%2F210%20passing-brightgreen) ![Coverage](https://img.shields.io/badge/coverage-88.73%25-brightgreen) ![Node](https://img.shields.io/badge/node-16+-green)

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Setup](#environment-setup)
- [Available Scripts](#available-scripts)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- PostgreSQL 15+ with pgvector extension
- SBERT service running on port 8000

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your settings (see Environment Variables section)

# 3. Initialize database
npm run prisma:generate
npm run prisma:push

# 4. Start development server
npm run dev
# Server runs on http://localhost:3000
```

### Verify Installation

```bash
# Test health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"OK","message":"Server is running","environment":"development","apiVersion":"1.0.0"}
```

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── env.js              # Environment variable validation
│   │   ├── logger.js           # Winston logging configuration
│   │   └── database.js         # Prisma client setup
│   │
│   ├── controllers/
│   │   ├── similarity.controller.js    # Main similarity checking endpoint
│   │   └── health.controller.js        # Health check endpoint
│   │
│   ├── services/
│   │   ├── jaccard.service.js   # Jaccard similarity algorithm
│   │   ├── tfidf.service.js     # TF-IDF scoring algorithm
│   │   └── sbert.service.js     # SBERT embedding service
│   │
│   ├── middleware/
│   │   ├── errorHandler.middleware.js     # Global error handler
│   │   ├── corsHandler.middleware.js      # CORS configuration
│   │   └── rateLimiter.middleware.js      # Rate limiting
│   │
│   ├── utils/
│   │   ├── logger.js            # Logging utility
│   │   └── validators.js        # Input validation helpers
│   │
│   ├── routes/
│   │   ├── similarity.routes.js  # Similarity check routes
│   │   └── health.routes.js      # Health check routes
│   │
│   └── server.js                 # Express app setup & port binding
│
├── prisma/
│   ├── schema.prisma             # Database schema definition
│   └── seed.js                   # Seed data loader
│
├── tests/
│   ├── unit/                     # Unit tests
│   ├── integration/              # API integration tests
│   ├── __mocks__/               # Mock data and services
│   └── setup.js                  # Jest configuration
│
├── .env.example                  # Environment template
├── jest.config.js               # Test runner configuration
├── package.json                 # Dependencies and scripts
├── ../docs/api/backend-api.md   # Full API reference
└── README.md                    # This file
```

---

## ⚙️ Environment Setup

### Required Environment Variables

```env
# Server Configuration
NODE_ENV=development              # development|test|production
PORT=3000                         # Server port

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/topic_similarity?schema=public

# SBERT Service
SBERT_SERVICE_URL=http://localhost:8000
SBERT_TIMEOUT=5000               # Milliseconds before SBERT timeout

# CORS & Security
CORS_ORIGIN=http://localhost:5173 # Frontend URL
CORS_CREDENTIALS=true

# Logging
LOG_LEVEL=info                    # error|warn|info|debug
LOG_FILE=logs/app.log
```

### Setup Instructions

```bash
# 1. Copy template
cp .env.example .env

# 2. Edit with your values
nano .env  # or use your preferred editor

# 3. Validate setup
npm run validate:env
```

### PostgreSQL Setup

```bash
# 1. Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

# 2. Create database
createdb topic_similarity

# 3. Update DATABASE_URL in .env
DATABASE_URL="postgresql://user:password@localhost:5432/topic_similarity?schema=public"

# 4. Sync schema with db push
npm run prisma:push
```

---

## 📜 Available Scripts

### Development

```bash
# Start with auto-reload (nodemon)
npm run dev

# Start production server
npm start

# Watch mode for development
npm run dev:watch
```

### Database Management

```bash
# Generate Prisma client
npm run prisma:generate

# Apply schema changes (recommended for managed databases)
npm run prisma:push

# This project currently uses db push rather than committed Prisma migrations
npm run prisma:push

# Open Prisma Studio (visual DB editor)
npm run prisma:studio

# Seed database with test data
npm run prisma:seed
```

### Testing

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test similarity.test.js

# Generate coverage report
npm run test:coverage

# Run tests without coverage
npm test -- --no-coverage
```

### Code Quality

```bash
# Run ESLint
npm run lint

# Fix linting issues
npm run lint:fix

# Format with Prettier
npm run format
```

---

## 🔌 API Endpoints

### Health Check

**Endpoint:** `GET /health`

Check if the API is running and healthy.

```bash
curl http://localhost:3000/health
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "overall_risk": "HIGH",
    "max_similarity": 88,
    "tier1_historical": [
      {
        "id": 123,
        "title": "Deep Learning for Medical Imaging",
        "keywords": "CNN, diagnosis, medical",
        "jaccard": 65.3,
        "tfidf": 72.1,
        "sbert": 88.0,
        "supervisor": "Dr. Smith",
        "year": "2023"
      }
    ],
    "tier2_current": [],
    "tier3_under_review": [],
    "recommendation": "High similarity detected."
  }
}
```
**Response (400 Bad Request):**
```json
{
  "status": "error",
  "message": "Topic must be at least 5 words",
  "code": "VALIDATION_ERROR"
}
```

**Status Codes:**
- `200 OK` - Similarity check successful
- `400 Bad Request` - Invalid input
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Database connection lost

[Full API Documentation →](../docs/api/backend-api.md)

---

## 🗄️ Database Schema

### Three Topic Tables

All three tables have identical schemas for consistency:

#### `historical_topics`
Archive of all previous submissions (read-only in production)

```sql
CREATE TABLE historical_topics (
  id SERIAL PRIMARY KEY,
  topic_title VARCHAR(500) NOT NULL,
  keywords TEXT,
  supervisor_name VARCHAR(200),
  session_year VARCHAR(10),
  status VARCHAR(50),
  embedding vector(384),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `current_session_topics`
Active semester submissions

```sql
CREATE TABLE current_session_topics (
  id SERIAL PRIMARY KEY,
  topic_title VARCHAR(500) NOT NULL,
  keywords TEXT,
  supervisor_name VARCHAR(200),
  student_id VARCHAR(50),
  session_year VARCHAR(10),
  status VARCHAR(50),
  embedding vector(384),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `under_review_topics`
Submissions in review (last 48 hours)

```sql
CREATE TABLE under_review_topics (
  id SERIAL PRIMARY KEY,
  topic_title VARCHAR(500) NOT NULL,
  keywords TEXT,
  supervisor_name VARCHAR(200),
  session_year VARCHAR(10),
  status VARCHAR(50),
  embedding vector(384),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Vector Index for Performance

```sql
-- Create index for fast similarity search
CREATE INDEX ON historical_topics USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX ON current_session_topics USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX ON under_review_topics USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

---

## 🧪 Testing

### Test Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── jaccard.test.js      # 24 tests
│   │   ├── tfidf.test.js        # 18 tests
│   │   └── sbert.test.js        # 26 tests
│   ├── controllers/
│   │   └── similarity.test.js   # 28 tests
│   └── middleware/
│       └── errorHandler.test.js # 28 tests
│
├── integration/
│   ├── similarity.integration.test.js  # 29 tests
│   └── health.integration.test.js      # 7 tests
│
└── __mocks__/
    ├── prismaMock.js
    └── sampleData.js
```

### Run Tests

```bash
# All tests with coverage
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Specific test file
npm test similarity.test.js

# Specific test suite
npm test -- --testNamePattern="Jaccard"

# Skip coverage
npm test -- --no-coverage
```

### Test Results

```
Test Suites: 8 passed, 8 total
Tests:       210 passed, 210 total
Snapshots:   0 total
Time:        33.391s
Coverage:    88.73% statements, 85.2% branches, 86.5% functions
```

### Writing Tests

```javascript
// Example test
describe('Jaccard Similarity', () => {
  test('should return 1.0 for identical strings', () => {
    const score = calculateJaccardSimilarity('hello world', 'hello world');
    expect(score).toBeCloseTo(1.0, 2);
  });

  test('should return 0 for completely different strings', () => {
    const score = calculateJaccardSimilarity('hello', 'world');
    expect(score).toBe(0);
  });
});
```

---

## 🎯 Algorithm Details

### Jaccard Similarity
- **Formula:** |A ∩ B| / |A ∪ B|
- **Characteristics:** Fast, exact word matching, no semantic understanding
- **Best for:** Detecting exact duplicates, simple similarity
- **Time complexity:** O(n)

### TF-IDF Scoring
- **Formula:** Sum of (TF × IDF) for common terms
- **Characteristics:** Fast, considers term importance, limited context
- **Best for:** Relevance ranking, term frequency analysis
- **Time complexity:** O(n log n)

### SBERT Embeddings
- **Model:** Sentence-BERT (all-MiniLM-L6-v2)
- **Output:** 384-dimensional vector
- **Similarity:** Cosine similarity between vectors
- **Characteristics:** Slow, semantic understanding, paraphrase-aware
- **Best for:** Deep semantic matching, paraphrases
- **Time complexity:** O(n) + SBERT API call

---

## 🚨 Error Handling

### Custom Error Codes

| Code | HTTP Status | Description | Action |
|------|-------------|-------------|--------|
| VALIDATION_ERROR | 400 | Invalid input | Check request format |
| TOPIC_REQUIRED | 400 | Topic field missing | Add topic field |
| SBERT_TIMEOUT | 503 | SBERT service slow | Falls back to 2 algorithms |
| DB_CONNECTION_ERROR | 500 | Database unavailable | Check database connection |
| UNEXPECTED_ERROR | 500 | Unknown error | Check logs |

### Error Response Format

```json
{
  "status": "error",
  "code": "SBERT_TIMEOUT",
  "message": "SBERT service exceeded timeout",
  "details": {
    "timeout": 5000,
    "attempts": 1
  }
}
```

### Graceful Degradation

If SBERT service fails:
1. System continues with Jaccard + TF-IDF
2. Response includes warning
3. Risk level calculated from available algorithms
4. User always gets a meaningful response

```json
{
  "status": "partial_success",
  "data": {
    "overall_risk": "MEDIUM",
    "max_similarity": 72.1,
    "tier1_historical": [],
    "tier2_current": [],
    "tier3_under_review": [],
    "recommendation": "SBERT unavailable; review lexical matches carefully."
  }
}
```
---

## 🔒 Security

### Input Validation
- Topic length: 5-200 words
- Keywords length: max 500 characters
- Sanitization: Remove HTML tags

### SQL Injection Prevention
- Uses Prisma ORM (parameterized queries)
- No raw SQL construction from user input

### Rate Limiting
- 100 requests per 15 minutes per IP
- Configurable via middleware

### CORS Protection
- Whitelist frontend origin
- Credentials: true (if needed)

### Security Headers
- Helmet.js middleware enabled
- Content-Security-Policy set
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

---

## 📊 Performance Optimization

### Database
- Vector indices for O(log n) embedding search
- Connection pooling (default 5 connections)
- Query timeouts: 10 seconds

### Caching Strategy
- SBERT embeddings cached in DB
- No in-memory cache (prevents memory bloat)

### Async Operations
- All database queries are non-blocking
- SBERT calls handled via Promise.race with timeout
- Proper cleanup on request completion

### Monitoring
- Response time tracking via Winston logs
- Error rate monitoring
- Database connection pool monitoring

---

## 🐛 Troubleshooting

### Common Issues

#### "Cannot find module 'dotenv'"
```bash
npm install
npm run prisma:generate
```

#### "Database connection error"
```bash
# Check DATABASE_URL in .env
# Verify PostgreSQL is running
# Check pgvector extension installed

npm run prisma:studio  # Visual database editor
```

#### "SBERT service unavailable"
```bash
# Ensure SBERT service is running
cd ../sbert-service
python app.py

# Check SBERT_SERVICE_URL in backend .env
# Default: http://localhost:8000
```

#### "Port 3000 already in use"
```bash
# Option 1: Kill process using port 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Option 2: Use different port
PORT=3001 npm run dev
```

#### "Tests failing"
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests without coverage (faster)
npm test -- --no-coverage

# Check for port conflicts (3000, 8000, 5173)
```

---

## 📚 Related Documentation

- [API Documentation](../docs/api/backend-api.md) - Complete endpoint reference
- [Architecture Guide](../docs/architecture/overview.md) - System design
- [Code Quality Report](../docs/archive/audits/code-quality-audit.md) - Code review findings
- [Testing Guide](../docs/testing/backend.md) - Testing best practices

---

## 🔗 Quick Links

| Link | Purpose |
|------|---------|
| [API Docs](../docs/api/backend-api.md) | All endpoints & examples |
| [Prisma Docs](https://www.prisma.io/docs) | Database ORM reference |
| [Express Docs](https://expressjs.com/) | Web framework guide |
| [Jest Docs](https://jestjs.io/) | Testing framework |

---

**Version:** v0.13.0  
**Last Updated:** February 16, 2026  
**Status:** ✅ Production Ready
