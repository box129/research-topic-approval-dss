# Comprehensive Testing Guide

This guide provides step-by-step instructions for thorough testing of the Topic Similarity API.

---

## Prerequisites

- ✅ PostgreSQL 14+ installed
- ✅ Node.js 18+ installed
- ✅ SBERT microservice available (optional, graceful degradation implemented)

---

## Part 1: Database Setup

### Step 1: Create Test Database

```powershell
# Connect to PostgreSQL
psql -U postgres

# In psql prompt:
DROP DATABASE IF EXISTS topic_similarity_test;
CREATE DATABASE topic_similarity_test;
\c topic_similarity_test
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### Step 2: Configure Test Environment

The `.env.test` file has been created with:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/topic_similarity_test?schema=public"
```

**Update the password** in `.env.test` if your PostgreSQL password is different.

### Step 3: Sync Prisma Schema

```powershell
cd topic-similarity-mvp/backend

# Set test environment
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/topic_similarity_test?schema=public"

# Sync schema to the test database
npm run prisma:push

# Generate Prisma Client
npx prisma generate
```

### Step 4: Seed Test Data

Create `prisma/seed-test.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Sample embedding (384 dimensions, all zeros for testing)
  const sampleEmbedding = Array(384).fill(0);
  
  // Historical topics
  await prisma.historicalTopics.createMany({
    data: [
      {
        title: 'Machine Learning in Healthcare',
        keywords: 'neural networks, diagnosis, medical imaging',
        sessionYear: '2022/2023',
        supervisorName: 'Dr. Smith',
        category: 'AI',
        embedding: sampleEmbedding
      },
      {
        title: 'Blockchain for Supply Chain',
        keywords: 'distributed ledger, transparency, logistics',
        sessionYear: '2021/2022',
        supervisorName: 'Dr. Johnson',
        category: 'Blockchain',
        embedding: sampleEmbedding
      },
      {
        title: 'Natural Language Processing Applications',
        keywords: 'BERT, transformers, sentiment analysis',
        sessionYear: '2022/2023',
        supervisorName: 'Dr. Williams',
        category: 'NLP',
        embedding: sampleEmbedding
      }
    ]
  });

  // Current session topics
  await prisma.currentSessionTopics.createMany({
    data: [
      {
        title: 'Deep Learning for Image Recognition',
        keywords: 'CNN, computer vision, classification',
        sessionYear: '2023/2024',
        supervisorName: 'Dr. Brown',
        category: 'AI',
        embedding: sampleEmbedding
      }
    ]
  });

  // Under review topics
  await prisma.underReviewTopics.createMany({
    data: [
      {
        title: 'AI in Medical Diagnosis',
        keywords: 'machine learning, healthcare, diagnosis',
        sessionYear: '2023/2024',
        supervisorName: 'Dr. Davis',
        category: 'AI',
        reviewStartedAt: new Date(),
        embedding: sampleEmbedding
      }
    ]
  });

  console.log('✅ Test data seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Run the seed:
```powershell
node prisma/seed-test.js
```

---

## Part 2: Unit Tests

### Run All Unit Tests

```powershell
cd topic-similarity-mvp/backend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/controllers/similarity.controller.test.js
```

### Expected Results

```
Test Suites: 6 passed, 6 total
Tests:       20+ passed, 20+ total
```

**Test Coverage Breakdown:**
- ✅ Input validation tests (2)
- ✅ Empty database tests (1)
- ✅ Full algorithm integration (1)
- ✅ SBERT graceful degradation (1)
- ✅ Risk level calculation (1)
- ✅ Tier filtering tests (2)
- ✅ Jaccard service tests (4)
- ✅ Preprocessing utility tests (3)
- ✅ Database connection tests (2)
- ✅ Server initialization tests (2)

---

## Part 3: Integration Tests

### Test 1: SBERT Service Health Check

```powershell
# Check if SBERT service is running
curl http://localhost:8000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "model": "sentence-transformers/all-MiniLM-L6-v2",
  "embedding_dim": 384
}
```

If SBERT is not running, the API will gracefully degrade to Jaccard + TF-IDF only.

### Test 2: Start the API Server

```powershell
cd topic-similarity-mvp/backend

# Start in development mode
npm run dev
```

**Expected Output:**
```
Server running on port 3000
Database connected successfully
```

### Test 3: Basic Similarity Check

```powershell
# Test with a topic similar to seeded data
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{\"topic\": \"Machine Learning for Medical Applications\"}'
```

**Expected Response Structure:**
```json
{
  "status": "success",
  "data": {
    "input_topic": "Machine Learning for Medical Applications",
    "overall_risk": "HIGH",
    "max_similarity": 88,
    "tier1_historical": [
      {
        "id": 1,
        "title": "Machine Learning in Healthcare",
        "jaccard": 65.3,
        "tfidf": 72.1,
        "sbert": 84.2
      }
    ],
    "tier2_current": [],
    "tier3_under_review": [
      {
        "id": 1,
        "title": "AI in Medical Diagnosis",
        "jaccard": 61.4,
        "tfidf": 68.2,
        "sbert": 88.7
      }
    ],
    "recommendation": "High similarity detected."
  },
  "processingTime": 1234
}
```

### Test 4: With Keywords

```powershell
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{\"topic\": \"Blockchain Technology\", \"keywords\": \"distributed systems, cryptocurrency\"}'
```

### Test 5: Error Handling - Missing Topic

```powershell
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{}'
```

**Expected Response:**
```json
{
  "error": "Topic is required"
}
```

### Test 6: Error Handling - Empty Topic

```powershell
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{\"topic\": \"\"}'
```

**Expected Response:**
```json
{
  "error": "Topic cannot be empty"
}
```

---

## Part 4: Performance Testing

### Test 1: Response Time Measurement

```powershell
# Measure response time
Measure-Command {
  curl -X POST http://localhost:3000/api/similarity/check `
    -H "Content-Type: application/json" `
    -d '{\"topic\": \"Test Topic\"}'
}
```

**Expected Times:**
- With SBERT (first request): 2-3 seconds
- With SBERT (subsequent): 1-2 seconds
- Without SBERT: 200-500ms

### Test 2: Load Testing (Optional)

Install Apache Bench or use PowerShell:

```powershell
# Simple load test - 100 requests
1..100 | ForEach-Object {
  curl -X POST http://localhost:3000/api/similarity/check `
    -H "Content-Type: application/json" `
    -d '{\"topic\": \"Test Topic $_\"}'
}
```

---

## Part 5: Edge Case Testing

### Test 1: Very Long Topic

```powershell
$longTopic = "A" * 1000
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d "{\"topic\": \"$longTopic\"}"
```

### Test 2: Special Characters

```powershell
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{\"topic\": \"Test @#$% & Special <> Characters\"}'
```

### Test 3: Unicode Characters

```powershell
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{\"topic\": \"机器学习 Machine Learning 🤖\"}'
```

### Test 4: Empty Database

```powershell
# Clear all data
psql -U postgres -d topic_similarity_test -c "TRUNCATE historical_topics, current_session_topics, under_review_topics CASCADE;"

# Test with empty database
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{\"topic\": \"Test Topic\"}'
```

**Expected:** Should return LOW risk with empty results.

---

## Part 6: Algorithm Verification

### Test 1: Jaccard Similarity

Create a test script `test-jaccard.js`:

```javascript
const { calculateJaccardSimilarity } = require('./src/services/jaccard.service');

const topic1 = 'machine learning artificial intelligence';
const topic2 = 'machine learning deep learning';

const similarity = calculateJaccardSimilarity(topic1, topic2);
console.log('Jaccard Similarity:', similarity);
// Expected: ~0.5 (2 common words out of 4 unique)
```

### Test 2: TF-IDF Similarity

Create a test script `test-tfidf.js`:

```javascript
const { calculateTfidfSimilarity } = require('./src/services/tfidf.service');

const documents = [
  'machine learning artificial intelligence',
  'machine learning deep learning',
  'blockchain distributed systems'
];

const similarity = calculateTfidfSimilarity(documents[0], documents);
console.log('TF-IDF Similarities:', similarity);
```

### Test 3: SBERT Similarity

```powershell
# Test SBERT embedding generation
curl -X POST http://localhost:8000/embed `
  -H "Content-Type: application/json" `
  -d '{\"text\": \"Machine Learning\"}'
```

**Expected:** 384-dimensional array of floats.

---

## Part 7: Service Integration Testing

### Test 1: SBERT Service Available

```powershell
# Start SBERT service
cd topic-similarity-mvp/sbert-service
python -m uvicorn app:app --port 8000

# Test API with SBERT
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{\"topic\": \"Test Topic\"}'
```

**Verify:** `algorithmStatus.sbert` should be `true`

### Test 2: SBERT Service Unavailable

```powershell
# Stop SBERT service (Ctrl+C)

# Test API without SBERT
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{\"topic\": \"Test Topic\"}'
```

**Verify:** 
- `algorithmStatus.sbert` should be `false`
- API should still return results using Jaccard + TF-IDF

---

## Part 8: Database Query Testing

### Test 1: Verify Pgvector Embeddings

```sql
-- Connect to test database
psql -U postgres -d topic_similarity_test

-- Check embedding format
SELECT id, title, embedding::text 
FROM historical_topics 
LIMIT 1;

-- Verify embedding dimensions
SELECT id, title, array_length(embedding, 1) as dimensions
FROM historical_topics;
```

**Expected:** All embeddings should have 384 dimensions.

### Test 2: Test 48-Hour Window

```sql
-- Insert old under_review topic
INSERT INTO under_review_topics (title, keywords, session_year, supervisor_name, category, review_started_at, embedding)
VALUES ('Old Topic', 'test', '2023/2024', 'Dr. Test', 'Test', NOW() - INTERVAL '3 days', ARRAY[0.0]::vector(384));

-- Test API - should not include old topic
```

---

## Part 9: Error Handling Testing

### Test 1: Database Connection Error

```powershell
# Stop PostgreSQL service temporarily
# Test API
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{\"topic\": \"Test\"}'
```

**Expected:** 500 error with appropriate message.

### Test 2: Malformed JSON

```powershell
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d 'invalid json'
```

**Expected:** 400 error.

### Test 3: Invalid Endpoint

```powershell
curl http://localhost:3000/api/invalid
```

**Expected:** 404 error.

---

## Part 10: Logging Verification

### Test 1: Check Log Files

```powershell
# View application logs
Get-Content topic-similarity-mvp/backend/logs/app.log -Tail 50

# View error logs
Get-Content topic-similarity-mvp/backend/logs/error.log -Tail 50
```

### Test 2: Verify Log Entries

After running tests, logs should contain:
- ✅ Request logs with timestamps
- ✅ Algorithm execution logs
- ✅ Database query logs
- ✅ Error logs (if any errors occurred)

---

## Testing Checklist

### Database Setup
- [ ] Test database created
- [ ] Pgvector extension installed
- [ ] Prisma schema synced with `npm run prisma:push`
- [ ] Test data seeded

### Unit Tests
- [ ] All unit tests passing
- [ ] Code coverage > 80%
- [ ] No failing tests

### Integration Tests
- [ ] SBERT service health check
- [ ] API server starts successfully
- [ ] Basic similarity check works
- [ ] Similarity with keywords works
- [ ] Error handling works

### Performance Tests
- [ ] Response time < 3s with SBERT
- [ ] Response time < 500ms without SBERT
- [ ] No memory leaks under load

### Edge Cases
- [ ] Long topics handled
- [ ] Special characters handled
- [ ] Unicode characters handled
- [ ] Empty database handled

### Algorithm Verification
- [ ] Jaccard similarity calculated correctly
- [ ] TF-IDF similarity calculated correctly
- [ ] SBERT embeddings generated correctly
- [ ] Public algorithm scores and risk level calculated correctly

### Service Integration
- [ ] Works with SBERT available
- [ ] Graceful degradation without SBERT
- [ ] Database queries work correctly

### Error Handling
- [ ] Database errors handled
- [ ] Malformed requests handled
- [ ] Invalid endpoints handled
- [ ] SBERT service errors handled

### Logging
- [ ] Request logs created
- [ ] Error logs created
- [ ] Log rotation works
- [ ] Log levels correct

---

## Troubleshooting

### Issue: Tests fail with database connection error

**Solution:**
1. Verify PostgreSQL is running
2. Check DATABASE_URL in `.env.test`
3. Verify test database exists
4. Check PostgreSQL logs

### Issue: SBERT tests fail

**Solution:**
1. Check if SBERT service is running on port 8000
2. Verify SBERT service health: `curl http://localhost:8000/health`
3. Check SBERT service logs
4. Tests should pass with graceful degradation if SBERT is unavailable

### Issue: Slow response times

**Solution:**
1. Check database indexes
2. Verify SBERT model is loaded
3. Check network latency to SBERT service
4. Review database query performance

### Issue: Memory leaks

**Solution:**
1. Check for unclosed database connections
2. Verify Prisma client is properly disconnected
3. Review SBERT service memory usage
4. Check for circular references in code

---

## Next Steps After Testing

1. **Review Test Results**
   - Document any failures
   - Fix identified issues
   - Re-run failed tests

2. **Performance Optimization**
   - Add database indexes
   - Implement caching
   - Optimize queries

3. **Production Preparation**
   - Set up production database
   - Configure environment variables
   - Set up monitoring and logging
   - Implement rate limiting

4. **Documentation**
   - Update API documentation
   - Create deployment guide
   - Document known issues

---

**Last Updated:** December 2024  
**Version:** v0.7.0
