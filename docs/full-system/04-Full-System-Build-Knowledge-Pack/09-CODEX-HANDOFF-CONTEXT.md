# 09 — Codex Handoff Context

> **Historical pre-Phase-6 handoff record.** Do not use its SBERT, lexical
> fallback, Vercel/Render, or database-deployment statements as current
> instructions. The current contract is Voyage-only for production semantics;
> use the root [AGENTS.md](../../../AGENTS.md), the
> [deployment runbook](../../deployment/deployment-runbook.md), and the
> [direct-similarity security contract](../../api/direct-similarity-security-contract.md).

> **Purpose:** Paste this file into Codex, place it at the root of the repo as `AGENT-CONTEXT.md`, or use it as the system prompt for any coding agent working on this project.

---

## Project Summary

**Name:** Decision Support System for Undergraduate Research Topic Approval
**Institution:** Department of Public Health, UNIOSUN (Osun State University)
**Type:** Full-stack web application — role-based decision-support platform
**Stack:** React 18 + Vite + Tailwind CSS (frontend) | Node.js + Express (backend) | Python FastAPI (SBERT microservice) | PostgreSQL with vector-ready topic data. Neon, Vercel, Render, and pgvector remain planned deployment/infrastructure targets that must be verified before final deployment.

**Problem being solved:** The department has no formal system for tracking and approving undergraduate research topics. Lecturers manually search Excel files using keywords to check if a proposed topic is a duplicate. This is slow, inconsistent, and misses paraphrased duplicates entirely.

**Solution:** A tri-algorithm similarity detection system (Jaccard + TF-IDF + SBERT) integrated into a role-based approval workflow with three user types: Student, Lecturer, and Admin.

---

## MVP Status (Already Built — Do Not Rebuild)

The MVP is complete and preserved as the MVP/core proof tag `v0.1.0-mvp-core`. It includes:

- ✅ Tri-algorithm similarity engine (Jaccard + TF-IDF + SBERT) running in parallel
- ✅ PostgreSQL/Prisma topic foundation with SBERT embedding support in the schema; final pgvector deployment details must be verified before production
- ✅ Three database tiers: `historical_topics`, `current_session_topics`, `under_review_topics`
- ✅ REST API: `POST /api/similarity/check`, `POST /api/v1/check-similarity`, `POST /embed`, `GET /api/v1/health`
- ✅ React frontend: single check-similarity screen (L5 — lecturer standalone checker)
- ✅ Risk classification exists, but 30%/60% remains a historical design assumption pending confirmation; do not change thresholds without an explicit settings/threshold PR
- ✅ Graceful SBERT degradation (falls back to Jaccard + TF-IDF when Python service is down)
- ✅ Response time target under local/demo conditions; verify performance again during Phase 6 and deployment readiness checks

---

## Full-System Target (v1.0 — Build Now)

The MVP core is promoted into a complete role-based platform. Build these in order:

### Phase order
1. Foundation (repo structure, design system, layout shell, shared components)
2. Authentication (httpOnly cookie-backed JWT, 3 roles, role routing, password reset)
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
  → Planned target: Vercel (verify before final deployment)
  → Communicates with Backend via REST API

Backend (Node.js + Express)
  → Planned target: Render (RAM/service tier must be verified before final deployment)
  → Cookie-backed JWT authentication middleware
  → Role-based access control (RBAC)
  → Communicates with DB and SBERT service
  → Uses EmailService adapter with mock provider first; Resend/SMTP/Nodemailer are future adapter options, not PR #2

SBERT Microservice (Python + FastAPI)
  → Planned target: Render or equivalent separate instance; verify before final deployment
  → Accepts: POST /embed with topic text
  → Returns: 384-dimension embedding vector
  → Backend NEVER calls SBERT directly from frontend

Database (PostgreSQL via Prisma; Neon/pgvector are planned targets to verify)
  → ORM: Prisma
  → Vector search support planned; pgvector/index details must be verified before final deployment
  → Tables: users, submissions, decisions, similarity_results,
            notifications, audit_log, academic_sessions,
            categories, system_settings,
            historical_topics, current_session_topics, under_review_topics
```

---

## Role-Based Routing

```
POST /api/v1/auth/login → sets `rtadss_session` httpOnly cookie and returns safe user profile + role
GET /api/v1/auth/me → returns current safe user profile from cookie-backed session
POST /api/v1/auth/logout → clears `rtadss_session`

role === "lecturer" → redirect to /lecturer/dashboard
role === "student"  → redirect to /student/dashboard
role === "admin"    → redirect to /admin/dashboard
```

- All `/lecturer/*`, `/student/*`, `/admin/*` routes require valid cookie-backed authentication
- Unauthenticated: redirect to `/login` (store intended route for post-login redirect)
- Cross-role access: redirect to own dashboard silently (no 403 page)
- Frontend must not store or decode JWTs in localStorage/sessionStorage. Role routing uses the login response user profile and/or `GET /api/v1/auth/me` with `withCredentials: true`.
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
- NEVER change risk thresholds or scoring logic without explicit approval. The 30%/60% values are historical design assumptions pending confirmation and should be resolved later in a dedicated settings/threshold PR.
- ALWAYS run the three algorithms in parallel (not sequential) to preserve the response-time target; verify actual timing during Phase 6
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
1. Database migrations (Prisma schema + committed `prisma migrate dev` migrations)
2. Backend API routes (with Postman/REST tests)
3. Frontend components
4. Frontend screen integration
5. End-to-end test of the workflow

The project previously used `prisma db push`, but v1 schema work now uses committed Prisma migrations. Treat `prisma db push` as legacy/local-only/experimental after the migration transition. Do not auto-reset an existing local database if Prisma detects drift; stop and ask for confirmation first.

---

## What Codex Must NOT Change Without Permission

1. The tri-algorithm similarity engine code
2. The `POST /api/similarity/check` and `POST /api/v1/check-similarity` endpoint signatures
3. The `POST /embed` SBERT endpoint
4. The risk threshold/scoring logic unless a dedicated settings/threshold PR explicitly approves it
5. The embedding column structure and vector deployment assumptions without verification
6. The gold standard test dataset and results
7. The `v0.1.0-mvp-core` git tag

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
