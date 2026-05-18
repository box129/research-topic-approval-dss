# 09 — Codex Handoff Context

> **Purpose:** Paste this file into Codex, place it at the root of the repo as `AGENT-CONTEXT.md`, or use it as the system prompt for any coding agent working on this project.

---

## Project Summary

**Name:** Decision Support System for Undergraduate Research Topic Approval
**Institution:** Department of Public Health, UNIOSUN (Osun State University)
**Type:** Full-stack web application — role-based decision-support platform
**Stack:** React 18 + Vite + Tailwind CSS (frontend) | Node.js + Express (backend) | Python FastAPI (SBERT microservice) | PostgreSQL + pgvector (Neon) | Vercel + Render (deployment)

**Problem being solved:** The department has no formal system for tracking and approving undergraduate research topics. Lecturers manually search Excel files using keywords to check if a proposed topic is a duplicate. This is slow, inconsistent, and misses paraphrased duplicates entirely.

**Solution:** A tri-algorithm similarity detection system (Jaccard + TF-IDF + SBERT) integrated into a role-based approval workflow with three user types: Student, Lecturer, and Admin.

---

## MVP Status (Already Built — Do Not Rebuild)

The MVP is complete and tagged as `v0.1-mvp`. It includes:

- ✅ Tri-algorithm similarity engine (Jaccard + TF-IDF + SBERT) running in parallel
- ✅ PostgreSQL + pgvector with pre-computed SBERT embeddings
- ✅ Three database tiers: `historical_topics`, `current_session_topics`, `under_review_topics`
- ✅ REST API: `POST /api/v1/check-similarity`, `POST /embed`, `GET /api/v1/health`
- ✅ React frontend: single check-similarity screen (L5 — lecturer standalone checker)
- ✅ Risk classification: LOW < 30%, MEDIUM 30–60%, HIGH ≥ 60%
- ✅ Graceful SBERT degradation (falls back to Jaccard + TF-IDF when Python service is down)
- ✅ Response time < 1 second

---

## Full-System Target (v1.0 — Build Now)

The MVP core is promoted into a complete role-based platform. Build these in order:

### Phase order
1. Foundation (repo structure, design system, layout shell, shared components)
2. Authentication (JWT, 3 roles, role routing, password reset)
3. Student workflow (St1–St4: dashboard, submit, submissions, check)
4. Lecturer workflow (L1–L6: dashboard, queue, review, decisions, check, supervisees)
5. Admin workflow (A1–A5: dashboard, users, repository, settings, audit log)
6. Polish and testing

### Build Now — 18 screens
```
AUTH: Login, Forgot Password, Reset Password
LECTURER: Dashboard (L1), Pending Reviews (L2), Similarity Results & Decision (L3),
          My Decisions (L4), Check Similarity (L5), Supervisees (L6)
STUDENT: Dashboard (St1), Submit Topic (St2), My Submissions (St3), Check My Topic (St4)
ADMIN: Dashboard (A1), User Management (A2), Topic Repository (A3),
       System Settings (A4), Audit Log (A5)
```

### Placeholder Only — 3 screens (v2.0 — deferred)
```
L7 - Research Trends       → /lecturer/research-trends
St5 - Research Explorer    → /student/research-explorer
A6 - Reports               → /admin/reports
```
Render a friendly "Coming soon" message. Do NOT return 404. Do NOT remove the nav items.

---

## Architecture Assumptions

```
Frontend (React + Vite + Tailwind)
  → Vercel (CDN, global edge)
  → Communicates with Backend via REST API

Backend (Node.js + Express)
  → Render (512 MB RAM)
  → JWT authentication middleware
  → Role-based access control (RBAC)
  → Communicates with DB and SBERT service
  → Sends emails via Resend or SMTP

SBERT Microservice (Python + FastAPI)
  → Render (separate instance)
  → Accepts: POST /embed with topic text
  → Returns: 384-dimension embedding vector
  → Backend NEVER calls SBERT directly from frontend

Database (PostgreSQL + pgvector, Neon)
  → ORM: Prisma
  → pgvector enabled for vector similarity search
  → Tables: users, submissions, decisions, similarity_results,
            notifications, audit_log, academic_sessions,
            categories, system_settings,
            historical_topics, current_session_topics, under_review_topics
```

---

## Role-Based Routing

```
POST /api/v1/auth/login → returns {token, role}

role === "lecturer" → redirect to /lecturer/dashboard
role === "student"  → redirect to /student/dashboard
role === "admin"    → redirect to /admin/dashboard
```

- All `/lecturer/*`, `/student/*`, `/admin/*` routes require valid JWT
- Unauthenticated: redirect to `/login` (store intended route for post-login redirect)
- Cross-role access: redirect to own dashboard silently (no 403 page)
- Profile lives in avatar dropdown top-right — not a nav item

---

## Navigation (by role)

**Lecturer sidebar:**
Dashboard | Pending Reviews | Check Similarity | My Decisions | Supervisees | Research Trends (placeholder)

**Student sidebar:**
Dashboard | Submit Topic | My Submissions | Check My Topic | Research Explorer (placeholder)

**Admin sidebar:**
Dashboard | User Management | Topic Repository | System Settings | Audit Log | Reports (placeholder)

---

## Key Design Decisions (Coding Guardrails)

### Similarity Engine
- NEVER change the three algorithms or remove any one of them
- NEVER change the default risk thresholds (30%, 60%) in code — they must be configurable via admin settings
- ALWAYS run the three algorithms in parallel (not sequential) to maintain < 1s response time
- ALWAYS implement graceful degradation: if SBERT is unavailable, continue with Jaccard + TF-IDF, set `sbert_available: false` in the response, show yellow warning banner

### Student-Facing Results (D26 Rule — Critical)
When showing similarity results to a student (St2 Step 2, St4), NEVER show:
- Individual algorithm scores (Jaccard %, TF-IDF %, SBERT %)
- Tier 2 (current session topics)
- Tier 3 (concurrent reviews)
- The decision panel (Approve / Request Changes / Reject)

ALWAYS show to students:
- Overall risk banner with plain language ("Your topic looks original" / "High similarity detected")
- Single combined risk percentage only
- Tier 1 match cards with matched keywords

### Topic Input Validation
Enforce on ALL topic input surfaces (L5, St2, St4):
- Minimum 7 words
- Maximum 24 words
- Minimum 50 characters
- Maximum 180 characters

### Decision Panel (L3 Only)
The sticky decision panel (Approve / Request Changes / Reject) appears ONLY on L3. Never on L5, St2, or St4.

### Student Submission — Never Block
On HIGH risk results in St2 Step 2: change button hierarchy (Revise = primary green, Submit anyway = secondary outlined) but NEVER disable or remove the "Submit anyway" option. Students have autonomy.

### Similarity Snapshots
When storing a decision in the `decisions` table, ALWAYS also save a frozen snapshot of the similarity results at that moment to `similarity_results`. This snapshot must never be recalculated — it is the historical record used in dispute resolution and audit.

### Audit Log
EVERY significant action must create an entry in `audit_log`:
- Every login / logout
- Every submission decision (approve / reject / request changes)
- Every data import
- Every user creation / suspension / deletion
- Every settings change (with before/after values)
- Every threshold change (with before/after values)
- Every end-of-session migration

### Email Notifications
Send emails at these trigger points:
- Student submits topic → "Submission confirmed"
- Lecturer approves → "Topic approved"
- Lecturer rejects → "Topic rejected" (include reason + notes)
- Lecturer requests changes → "Changes requested" (include guidance text verbatim)
- Admin creates user → "Account invitation" (include password setup link)

Email templates are editable by admin in A4 System Settings.

### Back Navigation on L3
"← Back to Pending Reviews" must restore L2's exact state: same view toggle (My Assigned / All Department), same filters, same scroll position. Do NOT use browser back behaviour for this — implement explicit state management (React context or URL query params).

---

## Implementation Order Within Each Phase

For each phase, follow this order:
1. Database migrations (Prisma schema + `prisma migrate dev`)
2. Backend API routes (with Postman/REST tests)
3. Frontend components
4. Frontend screen integration
5. End-to-end test of the workflow

---

## What Codex Must NOT Change Without Permission

1. The tri-algorithm similarity engine code
2. The `POST /api/v1/check-similarity` endpoint signature
3. The `POST /embed` SBERT endpoint
4. The risk threshold logic (30% / 60% defaults)
5. The pgvector embedding column structure (`vector(384)`)
6. The gold standard test dataset and results
7. The `v0.1-mvp` git tag

---

## File References

For full detail on any screen, component, or data model, see:

```
04-Full-System-Build-Knowledge-Pack/
  01-MVP-CORE-SNAPSHOT.md           ← What the MVP contains
  02-FULL-PROJECT-BUILD-SCOPE.md    ← v1.0 vs v2.0 scope
  03-SCREEN-INVENTORY-FILTERED.md   ← All 21 screens with priorities
  04-ROLE-BASED-WORKFLOWS.md        ← Step-by-step workflows
  05-ROUTES-AND-NAVIGATION-MAP.md   ← All routes and nav
  06-REUSABLE-COMPONENT-INVENTORY.md ← Component library
  07-DATA-MODEL-AND-API-NEEDS.md    ← DB tables and API routes
  08-IMPLEMENTATION-PHASES.md       ← Phased plan with acceptance criteria
  10-OPEN-QUESTIONS-AND-RISKS.md    ← Unresolved items
```

For full screen-level design detail:
```
SDLC-Project/04-Design/UX/Screens/
  L2-Pending-Reviews-Screen.md
  L3-Similarity-Results-Screen.md
  L4-My-Decisions-Screen.md
  L5-Check-Similarity-Screen.md
  L6-Supervisees-Screen.md
  L7-Research-Trends-Screen.md
  St1-Student-Dashboard-Screen.md
  St2-Submit-Topic-Screen.md
  St3-My-Submissions-Screen.md
  St4-Check-My-Topic-Screen.md
  St5-Research-Explorer-Screen.md
  Admin-Screen-Decisions.md
  Login-Screen.md
  Forgot-Password-Screen.md
  Reset-Password-Screen.md
```

---

*Generated: 2026-04-02 | Project: UNIOSUN Public Health Research Topic Approval DSS*
