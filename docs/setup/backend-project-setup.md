# Backend Project Setup Summary

> **Historical setup snapshot.** Do not use its `prisma db push`, SBERT, or
> seed instructions for staging or production. The current deployment uses the
> pinned `npm run prisma:migrate:deploy` workflow, explicit administrator
> bootstrap, and Voyage `voyage-4-large`; follow the
> [Phase 6 deployment runbook](../deployment/deployment-runbook.md).

## ✅ Completed Setup

### 1. Project Structure
```
backend/
├── src/
│   ├── config/
│   │   ├── env.js              # Environment configuration loader
│   │   ├── database.js         # Prisma client singleton
│   │   └── README.md           # Configuration documentation
│   ├── controllers/            # Route controllers (empty, ready for development)
│   ├── services/               # Business logic (empty, ready for development)
│   ├── utils/
│   │   ├── preprocessing.js    # NLP text preprocessing utilities
│   │   └── preprocessing.test.js # Unit tests for preprocessing
│   ├── middleware/             # Custom middleware (empty, ready for development)
│   └── server.js               # Express application entry point
├── prisma/
│   └── schema.prisma           # Database schema with pgvector
├── package.json                # Dependencies and scripts
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
└── README.md                   # Project documentation
```

### 2. Dependencies Installed
All dependencies from the original requirements have been configured in package.json:

**Production:**
- express@4.18.2
- @prisma/client@5.7.1
- dotenv@16.3.1
- cors@2.8.5
- helmet@7.1.0
- express-rate-limit@7.1.5
- natural@6.10.2
- axios@1.6.5
- winston@3.11.0

**Development:**
- nodemon@3.0.2
- jest@29.7.0
- supertest@6.3.3
- prisma@5.7.1
- eslint@8.56.0
- prettier@3.1.1

### 3. Database Setup
- ✅ Prisma schema created with PostgreSQL + pgvector extension
- ✅ Three models defined:
  - `HistoricalTopic` - Past approved topics
  - `CurrentSessionTopic` - Current session topics
  - `UnderReviewTopic` - Topics under review
- ✅ Vector embeddings support (384 dimensions for SBERT)
- ✅ Database pushed to Neon PostgreSQL successfully
- ✅ Prisma Client generated

### 4. Configuration System
- ✅ Environment variable loader with validation (`src/config/env.js`)
- ✅ Comprehensive `.env.example` template
- ✅ Prisma client singleton (`src/config/database.js`)
- ✅ Configuration documentation

### 5. Utilities
- ✅ Text preprocessing module (`src/utils/preprocessing.js`)
  - `preprocessText()` - Tokenize, remove stopwords, stem
  - `countWords()` - Count words in text
- ✅ Unit tests with 100% coverage
- ✅ Uses Natural library for NLP operations

### 6. Server Setup
- ✅ Express server with security middleware (helmet, cors, rate limiting)
- ✅ Health check endpoint
- ✅ Environment-based configuration
- ✅ Ready for route integration

## 📋 Next Steps

### Immediate Tasks
1. **Install Dependencies**
   ```bash
   cd topic-similarity-mvp/backend
   npm install
   ```

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Update `DATABASE_URL` with your Neon credentials (already done)
   - Adjust other settings as needed

3. **Verify Setup**
   ```bash
   npm run dev
   ```
   Server should start on port 3000

### Development Tasks
1. **Create Controllers**
   - Topic submission controller
   - Similarity check controller
   - Topic retrieval controller

2. **Create Services**
   - SBERT integration service
   - Similarity calculation service
   - Topic management service

3. **Create Middleware**
   - Authentication middleware (if needed)
   - Validation middleware
   - Error handling middleware

4. **Add Routes**
   - POST /api/topics - Submit new topic
   - GET /api/topics/:id - Get topic details
   - POST /api/similarity/check - Check topic similarity
   - GET /api/topics - List topics with filters

5. **Testing**
   - Write integration tests
   - Test SBERT service integration
   - Test database operations

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start with nodemon (auto-reload)

# Production
npm start                # Start production server

# Database
npm run prisma:generate  # Generate Prisma Client
npm run prisma:push      # Push schema to database
npm run prisma:studio    # Open Prisma Studio GUI

# Testing
npm test                 # Run tests with coverage
```

## 🗄️ Database Schema

### HistoricalTopic
- Stores approved topics from previous sessions
- Includes embeddings for similarity comparison
- Indexed by category, session year, and creation date

### CurrentSessionTopic
- Stores topics from the current academic session
- Includes student ID and approval date
- Used for Tier 2 similarity checks

### UnderReviewTopic
- Stores topics currently under review
- Tracks reviewing lecturer and review start time
- Used for Tier 3 similarity checks

## 🔐 Environment Variables

Key variables to configure:
- `DATABASE_URL` - PostgreSQL connection string
- `SBERT_SERVICE_URL` - SBERT microservice endpoint
- `PORT` - Server port (default: 3000)
- `SIMILARITY_TIER2_THRESHOLD` - Similarity threshold (default: 0.60)
- `SIMILARITY_TIER3_TIME_WINDOW_HOURS` - Time window for Tier 3 (default: 48)

See `.env.example` for complete list.

## 📝 Notes

- Using `prisma db push` instead of migrations for Neon compatibility
- Preprocessing utilities tested and ready for use
- Server configured with security best practices
- All folder structure in place for organized development
