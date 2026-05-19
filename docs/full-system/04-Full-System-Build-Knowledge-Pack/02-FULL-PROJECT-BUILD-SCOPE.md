# 02 — Full Project Build Scope

> **Source:** `Feature-Scope-MVP.md`, `Feature-Scope-Full.md`, `Screen-Inventory.md`, design decision files D1–D60

---

## ⚠️ Screen Count Correction

A documentation inconsistency exists and is resolved here.

One earlier chat response stated "Total screens: 23" but the actual breakdown adds up to **21 screens**:

| Role | Count |
|---|---|
| Shared Auth | 3 |
| Lecturer | 7 |
| Student | 5 |
| Admin | 6 |
| **Total** | **21** |

The corrected count of **21** is recorded in `SDLC-Project/04-Design/UX/Screens/Screen-Inventory.md` and should be used in all documentation, thesis writing, and implementation planning. The "23" figure appeared only in a chat response — no vault file contains it.

---

## Build Target: v1.0 is the Main Goal

This project has three build layers. The primary implementation target is **v1.0** — the full production-ready system with all three user roles, the complete approval workflow, and the admin panel.

---

## Layer 1 — MVP (Already Built)

**What it is:** A functional thesis proof-of-concept demonstrating the tri-algorithm similarity engine.

**What is included:**
- Tri-algorithm similarity engine (Jaccard + TF-IDF + SBERT)
- Basic lecturer check-similarity interface (L5 only)
- 60 sample topics in database
- 3 API endpoints
- Risk classification (LOW / MEDIUM / HIGH)
- No authentication, no roles, no workflow

**Status:** ✅ Complete. Do not rebuild — extend.

**Screen:** L5 — Check Similarity (MVP tag)

---

## Layer 2 — v1.0 Full Defense Build (Main Target)

**What it is:** The complete role-based decision-support platform. Everything needed for production deployment and thesis defense demonstration.

**What is included:**

### Authentication (all screens)
- Login, Forgot Password, Reset Password
- httpOnly cookie-based authentication
- Role detection and silent routing post-login

### Student workflow (St1–St4)
- St1 — Student Dashboard
- St2 — Submit Topic (3-step flow)
- St3 — My Submissions
- St4 — Check My Topic

### Lecturer workflow (L1–L6)
- L1 — Lecturer Dashboard
- L2 — Pending Reviews queue
- L3 — Similarity Results & Decision (with Approve / Request Changes / Reject)
- L4 — My Decisions history
- L5 — Check Similarity (promoted from MVP, now with auth context)
- L6 — Supervisees

### Admin panel (A1–A5)
- A1 — Admin Dashboard (system health + activity)
- A2 — User Management
- A3 — Topic Repository (import, clean, migrate)
- A4 — System Settings (thresholds, categories, email templates, session)
- A5 — Audit Log

### Backend additions needed for v1.0
- User authentication (httpOnly cookie session + bcrypt)
- Role-based access control (RBAC)
- Submission management (create, status tracking)
- Decision recording (approve/reject/request changes)
- Email notification service
- Tier 2 + Tier 3 similarity checks
- Audit log service
- Real historical topic database (2,000+ topics via import)

**Status:** 🎯 Build now. This is the primary target.

**Build Now screen count:** 18 screens = 3 auth + 6 lecturer (L1-L6) + 4 student (St1-St4) + 5 admin (A1-A5).
**Placeholder-only screen count:** 3 screens = L7, St5, A6.
**Total documented screens:** 21 screens.

---

## Layer 3 — v2.0 Analytics (Deferred — Design Complete)

**What it is:** The strategic intelligence and reporting layer. Requires a populated database of real approved topics to be meaningful.

**What is included:**
- L7 — Research Trends (lecturer analytics)
- St5 — Research Explorer (student discovery)
- A6 — Reports (admin analytics for NUC accreditation)

**Status:** ✅ Fully designed and documented. ⏳ Do not build until v1.0 is stable and the database contains real session data.

**Why deferred:** These screens show charts, trend data, and analytics. They are meaningless with an empty or small database. Building them before data exists wastes time and creates screens that appear broken at launch.

**What to do now:** Create placeholder routes that render a friendly "Coming soon — check back after the first approval session" screen. Do not build the full analytics components.

---

## Scope Boundaries — What Is Explicitly Out of Scope

The following are explicitly documented as out of scope in the Feature Scope files and must not be built:

- Multi-institutional features (cross-university comparison, national database)
- University-wide SSO / LDAP integration
- Multi-tenant architecture
- Mobile app (native iOS/Android)
- Social login (Google, Microsoft)
- Background job queues (Redis Queue — deferred to post-MVP)
- Real-time WebSocket connections (polling is sufficient for concurrent review alerts)

---

## Build Priority Summary

| Screen | Role | Version | Priority |
|---|---|---|---|
| AUTH-01 Login | All | v1.0 | Build Now |
| AUTH-02 Forgot Password | All | v1.0 | Build Now |
| AUTH-03 Reset Password | All | v1.0 | Build Now |
| L1 Lecturer Dashboard | Lecturer | v1.0 | Build Now |
| L2 Pending Reviews | Lecturer | v1.0 | Build Now |
| L3 Similarity Results & Decision | Lecturer | v1.0 | Build Now |
| L4 My Decisions | Lecturer | v1.0 | Build Now |
| L5 Check Similarity | Lecturer | MVP → promote | Build Now |
| L6 Supervisees | Lecturer | v1.0 | Build Now |
| L7 Research Trends | Lecturer | v2.0 | Placeholder only |
| St1 Student Dashboard | Student | v1.0 | Build Now |
| St2 Submit Topic | Student | v1.0 | Build Now |
| St3 My Submissions | Student | v1.0 | Build Now |
| St4 Check My Topic | Student | v1.0 | Build Now |
| St5 Research Explorer | Student | v2.0 | Placeholder only |
| A1 Admin Dashboard | Admin | v1.0 | Build Now |
| A2 User Management | Admin | v1.0 | Build Now |
| A3 Topic Repository | Admin | v1.0 | Build Now |
| A4 System Settings | Admin | v1.0 | Build Now |
| A5 Audit Log | Admin | v1.0 | Build Now |
| A6 Reports | Admin | v2.0 | Placeholder only |

**Build Now:** 18 screens
**Placeholder only:** 3 screens (L7, St5, A6)

---

*Source: `Feature-Scope-MVP.md`, `Feature-Scope-Full.md`, `Screen-Inventory.md`*
