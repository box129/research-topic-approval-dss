# 00 — README: Stage Overview

## What This Folder Is

This is the **04-Full-System-Build-Knowledge-Pack** — a filtered, derived knowledge base extracted from the full SDLC project vault. It exists as a single source of truth for the next stage of the project: building the complete role-based decision-support system on top of the existing MVP similarity engine.

This folder does not replace the original vault notes. It distils them into implementation-ready files. When something is unclear, check the original source notes linked throughout.

---

## Current Repo Decisions Override Older Vault Notes

The full-system repository is `box129/research-topic-approval-dss`. The old MVP proof repository is preserved separately as `box129/topic-similarity-detection-mvp`, with the MVP/core proof tagged as `v0.1.0-mvp-core`.

The current implementation decisions override older vault assumptions where they conflict:

- Authentication uses JWT stored only in the `rtadss_session` httpOnly cookie. The frontend must not store or decode JWTs in `localStorage` or `sessionStorage`.
- The backend returns a safe user profile with role from login and from `GET /api/v1/auth/me`; role routing uses that profile, not a frontend-decoded token.
- Email starts with an `EmailService` adapter and mock provider only. Real providers such as Resend, SMTP, or Nodemailer are future adapter implementations.
- v1 schema work uses committed Prisma migrations. `prisma db push` is legacy/local-only/experimental after the migration transition.
- Similarity thresholds are a known documentation/implementation conflict. Do not change scoring thresholds without explicit approval and a dedicated settings/threshold PR.
- The protected MVP similarity endpoints are `POST /api/similarity/check` and `POST /api/v1/check-similarity`.
- L7 Research Trends, St5 Research Explorer, and A6 Reports remain v2.0 placeholder routes until v1.0 is stable.

---

## Project Title

**Development of a Decision Support System for Undergraduate Research Topic Approval Using Rule-Based Logic and Tri-Algorithm Text Similarity — Public Health Department, UNIOSUN**

---

## What Stage the Project Is In

### Completed
- ✅ MVP similarity engine (Jaccard + TF-IDF + SBERT tri-algorithm core)
- ✅ Basic lecturer-facing check similarity interface (L5)
- ✅ PostgreSQL database with pgvector and 60 sample topics
- ✅ REST API (3 endpoints: POST /api/v1/check-similarity, POST /embed, GET /api/v1/health)
- ✅ Full UI/UX design for all 21 screens across all three roles
- ✅ All design decisions locked (D1–D60)
- ✅ Component breakdown files for 15 of 21 screens

### Now Entering
**Full-system build** — the MVP core is promoted into a complete role-based platform with:
- User authentication (Lecturer, Student, Admin roles)
- Student submission workflow
- Lecturer approval workflow (approve / request changes / reject)
- Admin panel (user management, topic repository, system settings, audit log)
- Tier 2 (current session) and Tier 3 (concurrent review) similarity checking
- Email notifications at every decision point
- Full historical topic import and data quality tools

### Deferred (v2.0 — design complete, build later)
- L7 Research Trends (lecturer analytics)
- St5 Research Explorer (student discovery)
- A6 Reports (admin analytics for NUC accreditation)

These screens are fully designed and documented but require a populated database of real approved topics to be meaningful. Do not implement them before v1.0 is stable and generating data.

---

## How to Use This Folder

### If you are the project owner
Read `08-IMPLEMENTATION-PHASES.md` first to understand the build sequence, then use `03-SCREEN-INVENTORY-FILTERED.md` to track what to build in each phase.

### If you are Claude (design/planning assistant)
Use this folder as the canonical reference for any implementation questions. Always check `10-OPEN-QUESTIONS-AND-RISKS.md` before answering questions about uncertain areas.

### If you are a coding agent (Codex, GitHub Copilot, etc.)
Start with `09-CODEX-HANDOFF-CONTEXT.md`. It contains the compact project summary, architecture assumptions, coding guardrails, and what you must not change without permission. Then read `07-DATA-MODEL-AND-API-NEEDS.md` for the database and API structure, and `06-REUSABLE-COMPONENT-INVENTORY.md` for the frontend component map.

### If you are a developer reading the repo
The files in this folder are the bridge between the design vault and the codebase. Each file is self-contained but cross-references others where relevant.

---

## File Index

| File | Purpose |
|---|---|
| `00-README-STAGE-OVERVIEW.md` | This file — orientation and usage guide |
| `01-MVP-CORE-SNAPSHOT.md` | What the MVP already contains and what must be protected |
| `02-FULL-PROJECT-BUILD-SCOPE.md` | MVP vs v1.0 vs v2.0 scope separation |
| `03-SCREEN-INVENTORY-FILTERED.md` | All 21 screens with implementation priority |
| `04-ROLE-BASED-WORKFLOWS.md` | Step-by-step workflows for all user types |
| `05-ROUTES-AND-NAVIGATION-MAP.md` | Full route map and role-based navigation |
| `06-REUSABLE-COMPONENT-INVENTORY.md` | Frontend component library derived from screen designs |
| `07-DATA-MODEL-AND-API-NEEDS.md` | Database tables and API routes for the full system |
| `08-IMPLEMENTATION-PHASES.md` | Phased build plan with deliverables and acceptance criteria |
| `09-CODEX-HANDOFF-CONTEXT.md` | Compact handoff file for coding agents |
| `10-OPEN-QUESTIONS-AND-RISKS.md` | Unresolved questions, risks, and contradictions |

---

## Source Vault Location

All source material lives in: `SDLC-Project/`

Key source files:
- `SDLC-Project/04-Design/UX/Screens/` — all screen breakdown files
- `SDLC-Project/04-Design/UX/Navigation-Structure.md` — nav decisions
- `SDLC-Project/03-Architecture/Phase-3A-System-Architecture-Backend-Design.md` — architecture
- `SDLC-Project/01-Discovery/Requirements/Feature-Scope-MVP.md` — MVP scope
- `SDLC-Project/01-Discovery/Requirements/Feature-Scope-Full.md` — full scope

---

*Created: 2026-04-02 | Source: SDLC-Project vault*
