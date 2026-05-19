# 01 — MVP Core Snapshot

> **Source:** `SDLC-Project/01-Discovery/Requirements/Feature-Scope-MVP.md`, `SDLC-Project/03-Architecture/Phase-3A-System-Architecture-Backend-Design.md`

---

## What the MVP Is

The MVP is a functional proof-of-concept that demonstrates tri-algorithm similarity detection works on Public Health research topics. It targets 85–90% accuracy on paraphrased duplicates.

**It is NOT a production system.** It has no authentication, no roles, no approval workflow, and no student or admin interfaces. It is a single-user lecturer tool for thesis demonstration.

---

## What the MVP Contains

### Similarity Engine (Core — Must Be Preserved)

**Three algorithms running in parallel:**

| Algorithm | Method | Strength |
|---|---|---|
| Jaccard | Exact word overlap (set intersection / union) | Catches identical or near-identical wording |
| TF-IDF | Term frequency–inverse document frequency cosine similarity | Catches topics sharing key terms with different phrasing |
| SBERT | Sentence-BERT semantic embeddings (all-MiniLM-L6-v2, 384 dimensions) | Catches semantically similar topics even with entirely different words |

**Pre-processing pipeline:**
- Lowercase normalisation
- Stop word removal
- Tokenisation

**Risk classification, historical design assumption pending confirmation:**
- 🟢 LOW: max similarity < 30%
- 🟡 MEDIUM: max similarity 30–60%
- 🔴 HIGH: max similarity ≥ 60%

Risk is determined by the highest score across all three algorithms for the best-matching topic.

Threshold values are a known documentation/implementation conflict. Do not change thresholds or scoring without explicit approval in a dedicated settings/threshold PR.

**Results output:**
- Top 5 similar topics with similarity percentages
- Overall risk badge (LOW / MEDIUM / HIGH)
- Matched keywords highlighted
- Per-algorithm scores (Jaccard %, TF-IDF %, SBERT %)

### Database (MVP State)

- PostgreSQL with vector-ready design; Neon and pgvector are assumed deployment/data-stack targets that must be verified before final deployment.
- Three tables: `historical_topics`, `current_session_topics`, `under_review_topics`
- Each table has an `embedding vector(384)` column for pre-computed SBERT embeddings
- 60 curated sample topics (not real UNIOSUN data)
- Topic schema: title, year, category, supervisor

### API (3 Endpoints)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/check-similarity` | Main endpoint — frontend calls this |
| POST | `/embed` | Internal SBERT microservice — backend calls this |
| GET | `/api/v1/health` | Health check — returns API + DB + SBERT status |

**Response time target:** under 1 second. Treat any 500-700 ms figure as observed under local/demo conditions only; verify again during Phase 6.

### Frontend (MVP State)

- React + Vite + Tailwind CSS
- Single main screen: topic input form + results display
- Topic input: textarea (7–24 words, 50–180 characters), category dropdown, submit button
- Results: similarity scores table, top 5 matches, risk badge, matched keywords
- Simple navigation: Home, About, Results
- No authentication, no role-based routing, no student or admin views

### Infrastructure

- Frontend: planned Vercel target (React SPA, global CDN)
- Backend: planned Render target (Node.js Express + Python FastAPI; memory plan must be verified)
- Database: planned Neon target (PostgreSQL/vector support and storage limits must be verified)
- Cost: $0 (free tier)

### Testing & Validation

- Gold standard dataset: 100 topic pairs (50 duplicate pairs, 50 unique pairs)
- Manual validation by subject matter experts
- Metrics: precision ≥ 80%, recall ≥ 80%, accuracy 85–90%
- Speed tests: target response time should be verified under Phase 6 conditions before final claims.
- Per-algorithm comparison completed (Jaccard vs TF-IDF vs SBERT)

---

## Known Limitations of the MVP

| Limitation | Impact | Resolution in v1.0 |
|---|---|---|
| No authentication | Anyone can access; no role separation | Add httpOnly cookie auth with 3 roles |
| No approval workflow | Lecturer sees results but cannot record a decision in the system | Add approve/reject/request-changes actions |
| No Tier 2 (current session) | Cannot check against topics approved this session | Add current_session_topics tier |
| No Tier 3 (concurrent reviews) | Cannot detect when two lecturers review similar topics simultaneously | Add under_review_topics tier with real-time check |
| 60 sample topics only | Not real UNIOSUN data; too small for production | Import full historical database via admin panel |
| No email notifications | Decision outcomes not communicated automatically | Add notification service |
| No student portal | Students cannot self-check or submit | Add full student workflow |
| No admin panel | No user management, data import, or configuration | Add full admin workflow |
| Local/free-tier only | No SSL beyond auto-provisioned, no scalability | Cloud deployment with proper SSL |
| No real UNIOSUN historical data | System cannot detect actual past duplicates | Admin data import in v1.0 |

---

## What Must Be Protected When Moving to v1.0

The following must not be broken or removed during the full-system build:

1. **The tri-algorithm engine** — Jaccard, TF-IDF, and SBERT must continue running in parallel. Do not remove any algorithm. Do not change scoring thresholds without explicit approval.

2. **The SBERT microservice isolation** — SBERT runs in a separate Python FastAPI service. This is an architectural decision (ADR #2) made for language separation and failure isolation. The system must gracefully degrade to Jaccard + TF-IDF only when SBERT is unavailable — it must not fail completely.

3. **The embedding storage design** — Topic embeddings must be preserved. Any pgvector-specific deployment detail must be verified before final deployment.

4. **The response time target** — The three algorithms run in parallel (not sequentially) to support the target response time. Do not serialise them.

5. **The risk classification thresholds** — Threshold values are a known documentation/implementation conflict. Treat 30/60 as a historical design assumption pending confirmation, not an implementation instruction.

6. **The topic input validation** — 7–24 words, 50–180 characters. This is documented in the design spec and validated in the MVP. It must be enforced consistently across all topic input surfaces (L5, St2, St4).

7. **The gold standard dataset and test results** — These belong to the thesis. Do not modify or delete them.

---

## MVP → v1.0 Transition Summary

The MVP similarity engine becomes the core of the full system. Every new feature wraps around it without changing it:

```
MVP core (preserve as-is)
    ↓
Add: Authentication + role-based routing
    ↓
Add: Student submission workflow (St1–St4)
    ↓
Add: Lecturer approval workflow (L1–L6)
    ↓
Add: Admin panel (A1–A5)
    ↓
Add: Tier 2 + Tier 3 similarity checks
    ↓
Add: Email notification service
    ↓
Add: Real historical topic database (import)
    ↓ (deferred)
Add: Analytics layer (L7, St5, A6)
```

---

*Source: `Feature-Scope-MVP.md`, `Phase-3A-System-Architecture-Backend-Design.md`*
