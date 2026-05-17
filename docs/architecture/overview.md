# Architecture

## High-Level Overview

Topic Similarity MVP checks a submitted research topic against existing topic records. The system has a React/Vite frontend, a Node/Express backend, a Python FastAPI SBERT-style embedding service, and a PostgreSQL database accessed through Prisma.

The backend is the main coordinator. It receives topic submissions, reads existing topics from the database, runs similarity algorithms, groups matches into tiers, calculates a risk level, and returns results to the frontend.

## Main System Parts

### Backend

Located in `backend/`.

- `backend/src/server.js` defines the Express app, health endpoints, and similarity routes.
- `backend/src/controllers/similarity.controller.js` coordinates validation, database reads, algorithm execution, result tiering, and risk calculation.
- `backend/src/services/jaccard.service.js` calculates token-overlap similarity.
- `backend/src/services/tfidf.service.js` calculates TF-IDF/cosine similarity.
- `backend/src/services/sbert.service.js` calls the SBERT service and calculates embedding similarity.
- `backend/src/utils/preprocessing.js` handles tokenization, stopword removal, and stemming.

### Frontend

Located in `frontend/`.

- `frontend/src/App.jsx` submits topic data to the backend and maps the backend response into UI-friendly result data.
- `frontend/src/components/features/TopicInput/TopicForm.jsx` handles topic, keywords, category input, and validation.
- `frontend/src/components/features/Results/ResultsDisplay.jsx` displays risk level, tiered matches, and expandable technical scores.
- `frontend/vite.config.js` configures the Vite dev server and API proxy.

### SBERT Service

Located in `sbert-service/`.

- `sbert-service/app.py` exposes FastAPI endpoints for health checks and embedding generation.
- The service is intended to use `sentence-transformers/all-MiniLM-L6-v2`.
- If the model or dependency is unavailable, the service can fall back to deterministic hash-based embeddings.

### Database / Prisma Layer

Located mainly in `backend/prisma/`.

- `backend/prisma/schema.prisma` defines `HistoricalTopic`, `CurrentSessionTopic`, and `UnderReviewTopic`.
- `backend/prisma/seed.js` and CSV files support sample/import data.
- The similarity controller currently uses Prisma raw SQL queries against the topic tables.

## Request Flow

1. A user enters a research topic in the frontend form.
2. `frontend/src/App.jsx` sends the submission to `POST /api/similarity/check`.
3. The backend validates the request body.
4. The backend reads historical, current-session, and under-review topics from the database.
5. The backend preprocesses topic text and runs Jaccard, TF-IDF, and SBERT similarity.
6. SBERT similarity calls the Python service for a query embedding and uses stored or generated topic embeddings.
7. The backend returns separate public algorithm scores, filters results into tiers, and calculates LOW/MEDIUM/HIGH risk.
8. The backend returns tiered results using the current public API contract.
9. The frontend maps the response and renders the risk banner, matches, and technical score details.

## Protected / High-Risk Areas

- Similarity scoring and result tiering in `backend/src/controllers/similarity.controller.js`.
- Tier filtering and LOW/MEDIUM/HIGH risk calculation.
- API response shape consumed by `frontend/src/App.jsx`.
- Prisma schema and database table/field mappings.
- SBERT service fallback behavior and embedding dimensions.
- Frontend result mapping and display components.
- Dev-server/API proxy configuration in `frontend/vite.config.js`.

## Known Uncertainties

- Backend runtime startup in the current environment: needs verification.
- Frontend proxy target versus documented backend port: needs verification.
- Whether the SBERT service loads real `sentence-transformers` or uses fallback mode: needs verification.
- Whether database schema, seed data, and actual database are aligned: needs verification.
- Current backend and frontend test status: needs verification.
- Whether API documentation exactly matches the current backend response shape: needs verification.
