# Manual Testing Steps

Since automated database setup requires interactive password entry, here are the manual steps to complete testing.

## Step 1: Database Setup

Open a new PowerShell terminal and run these commands one by one:

```powershell
# Connect to PostgreSQL
psql -U postgres

# In the psql prompt, run:
DROP DATABASE IF EXISTS topic_similarity_test;
CREATE DATABASE topic_similarity_test;
\c topic_similarity_test
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

## Step 2: Configure Environment

```powershell
cd topic-similarity-mvp/backend

# Copy test environment file
Copy-Item .env.test .env

# Edit .env if your PostgreSQL password is different from 'postgres'
```

## Step 3: Sync Prisma Schema

```powershell
# Set environment variable
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/topic_similarity_test?schema=public"

# Sync schema to the test database
npm run prisma:push

# Generate Prisma Client
npx prisma generate
```

## Step 4: Seed Test Data

```powershell
node prisma/seed-test.js
```

Expected output:
```
🌱 Seeding test database...
Clearing existing data...
Seeding historical topics...
Seeding current session topics...
Seeding under review topics...

✅ Test data seeded successfully!
   Historical Topics: 8
   Current Session Topics: 3
   Under Review Topics: 3
   Total: 14
```

## Step 5: Run Unit Tests

```powershell
npm test
```

Expected: All tests should pass now that database is set up.

## Step 6: Start the Server

```powershell
npm run dev
```

Expected output:
```
Server running on port 3000
Database connected successfully
```

## Step 7: Test API Endpoints

Open a new PowerShell terminal and run these curl commands:

### Test 1: Basic Similarity Check

```powershell
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{\"topic\": \"Machine Learning Applications\"}'
```

**Expected:** JSON response with similarity results

### Test 2: With Keywords

```powershell
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{\"topic\": \"Blockchain Technology\", \"keywords\": \"distributed systems\"}'
```

**Expected:** JSON response with keywords included

### Test 3: Error Handling - Missing Topic

```powershell
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{}'
```

**Expected:** 400 error with message "Topic is required"

### Test 4: Error Handling - Empty Topic

```powershell
curl -X POST http://localhost:3000/api/similarity/check `
  -H "Content-Type: application/json" `
  -d '{\"topic\": \"\"}'
```

**Expected:** 400 error with message "Topic cannot be empty"

## Step 8: Check SBERT Service (Optional)

If you have the SBERT service running:

```powershell
curl http://localhost:8000/health
```

**Expected:** JSON response with service status

## Step 9: Run Comprehensive Test Suite

```powershell
.\run-all-tests.ps1
```

This will run all unit and integration tests and generate a report.

## Step 10: Verify Results

Check that:
- ✅ All unit tests pass
- ✅ API endpoints respond correctly
- ✅ Error handling works as expected
- ✅ Database queries execute successfully
- ✅ Similarity scores are calculated
- ✅ Risk levels are determined correctly

## Troubleshooting

### Database Connection Error

```powershell
# Check if PostgreSQL is running
Get-Service postgresql*

# If not running, start it
Start-Service postgresql-x64-14
```

### Port Already in Use

```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Prisma Client Not Generated

```powershell
npx prisma generate
```

### Test Data Not Seeded

```powershell
# Clear and re-seed
node prisma/seed-test.js
```

## Success Criteria

All tests pass when:
- ✅ Database is set up with pgvector
- ✅ Prisma schema is synced with `npm run prisma:push`
- ✅ Test data is seeded
- ✅ Server is running
- ✅ All API endpoints respond correctly
- ✅ Error handling works
- ✅ Similarity calculations are accurate

## Next Steps After Testing

1. Review test results
2. Fix any failing tests
3. Optimize performance if needed
4. Prepare for production deployment
5. Set up monitoring and logging
