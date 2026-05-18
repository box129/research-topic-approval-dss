# 08 — Implementation Phases

> **Source:** `Feature-Scope-MVP.md`, `Feature-Scope-Full.md`, `02-FULL-PROJECT-BUILD-SCOPE.md`, `03-SCREEN-INVENTORY-FILTERED.md`

---

## Guiding Principles

1. **Never break the MVP core.** The tri-algorithm similarity engine is the thesis deliverable. Every phase wraps around it — nothing replaces it.
2. **v1.0 is the target.** All 18 "Build Now" screens must be complete before any v2.0 work begins.
3. **Build vertically, not horizontally.** Complete one workflow end-to-end before starting the next. Do not build all frontends before any backend.
4. **Database first, then API, then UI.** Each phase follows this order within its scope.
5. **Test each phase before advancing.** Each phase has acceptance criteria that must pass.

---

## Phase 0 — Freeze and Tag the MVP

**Goal:** Protect the thesis MVP as a stable, tagged baseline before any new code is written.

**Deliverables:**
- [ ] Git tag: `v0.1-mvp` on the current working commit
- [ ] All existing tests pass and are recorded
- [ ] MVP gold standard dataset results documented and committed
- [ ] README updated to document MVP state clearly
- [ ] Environment variables documented (`.env.example`)
- [ ] Deployment URLs documented (Vercel frontend, Render backend, Neon DB)
- [ ] No new features added in this phase

**Screens affected:** None (freeze only)

**Backend needs:** None (document existing)

**Acceptance criteria:**
- `git tag v0.1-mvp` exists
- `POST /api/v1/check-similarity` returns correct results
- `GET /api/v1/health` returns `{"status": "healthy"}`
- MVP frontend renders correctly at Vercel URL
- All test results documented in `test-results/mvp-baseline.md`

---

## Phase 1 — Repository Foundation and Layout Shell

**Goal:** Set up the full-system repository structure, design system, shared components, and role-based layout shell — without any business logic yet.

**Deliverables:**
- [ ] Tailwind CSS configured with design system tokens (colors, spacing, typography)
- [ ] `AppLayout` component (sidebar + topbar + content area)
- [ ] `Sidebar` component — renders correct nav items per role prop
- [ ] `Topbar` component with avatar dropdown
- [ ] `PageHeader` component
- [ ] Role-based routing scaffold: `/lecturer/*`, `/student/*`, `/admin/*`
- [ ] All route files created (even if just rendering placeholder text)
- [ ] v2.0 placeholder component (renders for L7, St5, A6 routes)
- [ ] Shared state components: `EmptyState`, `LoadingState`, `ErrorState`
- [ ] `AlertBanner` component
- [ ] `StatCard` component
- [ ] `RiskBadge` and `StatusBadge` components
- [ ] `Modal` wrapper component

**Screens affected:** All 21 (layout shell only — no content)

**Backend needs:** None yet

**Acceptance criteria:**
- Navigating to `/lecturer/dashboard` renders the lecturer sidebar with correct nav items
- Navigating to `/student/dashboard` renders the student sidebar
- Navigating to `/admin/dashboard` renders the admin sidebar
- Navigating to `/lecturer/research-trends` renders the v2.0 placeholder (not a 404)
- Design system tokens visible and correct across all components
- No role-crossing: each role only sees its own nav items

---

## Phase 2 — Authentication System

**Goal:** Add JWT-based authentication with three roles and role-based routing guards.

**Deliverables:**

**Database:**
- [ ] `users` table created and migrated
- [ ] `academic_sessions` table created
- [ ] `categories` table created and seeded with 8 Public Health disciplines
- [ ] `system_settings` table created and seeded with defaults

**Backend:**
- [ ] `POST /api/v1/auth/login` — validates credentials, returns JWT with role
- [ ] `POST /api/v1/auth/logout`
- [ ] `POST /api/v1/auth/forgot-password` — sends reset email (always returns success)
- [ ] `POST /api/v1/auth/reset-password` — validates token, updates password
- [ ] `GET /api/v1/auth/me`
- [ ] JWT middleware for protected routes
- [ ] Role-based access control middleware (rejects cross-role access)
- [ ] Email service integration (Resend or Nodemailer + SMTP)
- [ ] Password reset token: single-use, 30-minute expiry

**Frontend:**
- [ ] AUTH-01 Login screen — full implementation
- [ ] AUTH-02 Forgot Password screen — full implementation
- [ ] AUTH-03 Reset Password screen — full implementation
- [ ] Auth context / JWT storage (httpOnly cookie or secure localStorage)
- [ ] Protected route guards (redirect to `/login` if unauthenticated)
- [ ] Post-login role routing (reads role from JWT, redirects to correct dashboard)
- [ ] Avatar dropdown connected to real user data

**Screens affected:** AUTH-01, AUTH-02, AUTH-03

**Acceptance criteria:**
- Login with valid lecturer credentials → redirected to `/lecturer/dashboard`
- Login with valid student credentials → redirected to `/student/dashboard`
- Login with valid admin credentials → redirected to `/admin/dashboard`
- Login with invalid credentials → error banner shown, no redirection
- Navigating to `/lecturer/dashboard` without auth → redirected to `/login`
- Navigating to `/student/*` as a lecturer → redirected to `/lecturer/dashboard`
- Forgot password flow sends email with reset link
- Reset link expires after 30 minutes
- Used reset token cannot be reused

---

## Phase 3 — Student Workflow

**Goal:** Implement the complete student submission experience (St1–St4).

**Deliverables:**

**Database:**
- [ ] `submissions` table created and migrated
- [ ] `similarity_results` table created and migrated
- [ ] `notifications` table created
- [ ] `supervisor_assignments` table created

**Backend:**
- [ ] `GET /api/v1/submissions` (student sees their own only)
- [ ] `POST /api/v1/submissions` (create submission, trigger pre-check)
- [ ] `POST /api/v1/submissions/draft` (save draft)
- [ ] `GET /api/v1/submissions/:id`
- [ ] `POST /api/v1/check-similarity` — already exists, confirm it stores result in `similarity_results`
- [ ] `GET /api/v1/users/:id/supervisees` (returns supervisor's students — needed by St1 for supervisor name)
- [ ] Email notification: "Submission confirmed" triggered on submission
- [ ] Notification logged to `notifications` table

**Frontend:**
- [ ] St1 — Student Dashboard: all 4 states (Awaiting Revision, Pending, Approved, Empty)
- [ ] St2 — Submit Topic: full 3-step flow (Enter → Pre-check → Confirm)
- [ ] St3 — My Submissions: expandable rows, revision thread, email deep link auto-expand
- [ ] St4 — Check My Topic: all 4 states (Empty, LOW, HIGH, Degraded)
- [ ] `TopicInputForm` component fully implemented
- [ ] `SimilarityResultPanel` (student variant — D26 rules: no algorithm scores, no Tier 2/3)
- [ ] `RiskBanner` (student language variant)
- [ ] `InlineDetailPanel` component

**Screens affected:** St1, St2, St3, St4

**Acceptance criteria:**
- Student can submit a topic through all 3 steps
- Step 2 auto-runs similarity check and displays simplified results
- HIGH risk shows swapped button hierarchy; student can still proceed
- Submission appears in St3 with "Pending Review" status
- Student receives confirmation email
- St3 email deep link opens correct submission expanded
- St4 can be used independently of St2 any number of times
- Draft save works and persists topic text
- "Revise and Resubmit" pre-fills St2 Step 1

---

## Phase 4 — Lecturer Workflow

**Goal:** Implement the complete lecturer review and decision experience (L1–L6).

**Deliverables:**

**Database:**
- [ ] `decisions` table created and migrated
- [ ] `under_review_topics` table — confirm exists from MVP or create

**Backend:**
- [ ] `GET /api/v1/submissions` (lecturer sees assigned + all department depending on query)
- [ ] `GET /api/v1/submissions/:id` (full detail with similarity result)
- [ ] `POST /api/v1/submissions/:id/decision` (approve / reject / request changes)
- [ ] `GET /api/v1/users/:id/supervisees` (lecturer's assigned students)
- [ ] Tier 2 similarity check integration (queries `current_session_topics`)
- [ ] Tier 3 concurrent review detection (queries `under_review_topics`)
- [ ] `under_review_topics` insert on L3 page open, delete on decision made
- [ ] Email notifications: approved, rejected, changes_requested — triggered on decision
- [ ] Audit log entry on every decision

**Frontend:**
- [ ] L1 — Lecturer Dashboard: stat cards, concurrent alert banner, recent decisions feed, quick actions
- [ ] L2 — Pending Reviews: view toggle, filter bar, table, days waiting escalation
- [ ] L3 — Similarity Results & Decision: full implementation including all three tier sections, sticky decision panel, three decision modals
- [ ] L4 — My Decisions: filter bar, table, inline summary card, frozen similarity snapshot
- [ ] L5 — Check Similarity: promote from MVP, wrap with auth, ensure Tier 2 + 3 now active
- [ ] L6 — Supervisees: filter pills, student rows, inline submission panels
- [ ] `AlgorithmScoreRow` component
- [ ] `TierMatchSection` component (× 3 tier types)
- [ ] `TopicCard` component
- [ ] `DecisionPanel` component (sticky)
- [ ] `ApproveModal`, `RequestChangesModal`, `RejectModal`

**Screens affected:** L1, L2, L3, L4, L5, L6

**Acceptance criteria:**
- L2 "My Assigned" shows only topics assigned to this lecturer's students
- L2 "All Department" shows all pending topics
- Days waiting escalates colour correctly at 7 and 14 days
- L3 loads all three tiers correctly
- Tier 1 expanded by default, Tiers 2 and 3 collapsed with match count
- Sticky decision panel always visible while scrolling L3
- Approve modal → submission status → "Approved" → student email sent
- Request Changes modal → requires ≥20 chars guidance → student email sent with guidance verbatim
- Reject modal → requires reason selection → student email sent with reason + notes
- All decisions logged to audit log
- L4 shows correct decisions with frozen snapshot
- L6 shows all assigned students regardless of submission status
- Concurrent alert banner appears on L1 and L3 when Tier 3 has a match

---

## Phase 5 — Admin Workflow

**Goal:** Implement the complete admin panel (A1–A5).

**Deliverables:**

**Database:**
- [ ] `audit_log` table confirmed migrated
- [ ] All settings seeded in `system_settings`

**Backend:**
- [ ] `GET /api/v1/users` (admin: all users, filterable by role/status)
- [ ] `POST /api/v1/users` (create user + send invite email)
- [ ] `PATCH /api/v1/users/:id` (edit role / status)
- [ ] `DELETE /api/v1/users/:id`
- [ ] `GET /api/v1/topics` (with filters)
- [ ] `POST /api/v1/topics/import` (multipart CSV/Excel upload, column mapping, validation)
- [ ] `GET /api/v1/topics/duplicates` (similarity scan across historical topics)
- [ ] `POST /api/v1/topics/resolve-duplicate`
- [ ] `POST /api/v1/topics/migrate-session`
- [ ] `GET /api/v1/settings` + `PATCH /api/v1/settings`
- [ ] `POST /api/v1/settings/test-email`
- [ ] `PATCH /api/v1/categories`
- [ ] `GET /api/v1/audit-log` (with filters) + `GET /api/v1/audit-log/export`
- [ ] Admin-level RBAC: all `/admin/*` API routes require role = "admin"

**Frontend:**
- [ ] A1 — Admin Dashboard: health cards, conditional alert banner, usage stats, activity feed
- [ ] A2 — User Management: role tabs, search, Add User modal, three-dot row menus
- [ ] A3 — Topic Repository: action bar, filter table, 4-step import wizard modal, duplicate resolution panel
- [ ] A4 — System Settings: left sidebar tabs, threshold sliders with live preview, category manager, email template editor, session config, per-section save with unsaved indicator
- [ ] A5 — Audit Log: filter bar, log table, inline expandable rows with variable content depth, export
- [ ] `ImportWizard` component (4-step modal)
- [ ] `DuplicateResolutionPanel` component
- [ ] `ServiceHealthCard` component
- [ ] `AuditLogTable` component

**Screens affected:** A1, A2, A3, A4, A5

**Acceptance criteria:**
- A1 health cards reflect real API health check response
- SBERT down → amber alert banner appears on A1
- DB down → red alert banner, stats show "—"
- A2 Add User → user created, invite email sent, row appears in table
- A2 Suspend → user cannot log in
- A2 Delete → confirmation required, user removed
- A3 Import wizard validates data before commit, reports skipped rows
- A3 Find Duplicates scan returns flagged pairs
- A3 End-of-session migration moves approved current topics to historical
- A4 Threshold change → live preview updates, save required, audit log entry created
- A4 Email template → Save → Test Email sends correctly
- A4 unsaved changes warning fires on navigation away
- A5 filter by "Topic Decisions" shows only decision events
- A5 row expansion shows frozen similarity snapshot for decision events
- A5 Export CSV downloads correct data

---

## Phase 6 — Polish, Testing, and Documentation

**Goal:** Production readiness — end-to-end testing, performance, accessibility, and thesis documentation.

**Deliverables:**
- [ ] End-to-end tests: full student submission → lecturer decision → email notification flow
- [ ] API integration tests: all endpoints tested with correct role access
- [ ] Accessibility audit: WCAG 2.1 AA on all 18 "Build Now" screens
- [ ] Performance: similarity check response time < 1 second verified under load
- [ ] SBERT degraded mode: verified fallback to Jaccard + TF-IDF works correctly
- [ ] Mobile warning banner: verified on screens < 768px
- [ ] Real UNIOSUN topic data imported via A3 (or confirmed test dataset ≥ 200 topics)
- [ ] All email templates tested and rendered correctly
- [ ] Concurrent review detection (Tier 3) tested with two simultaneous lecturer sessions
- [ ] Error states: verified on all screens (DB error, SBERT down, validation errors)
- [ ] User guide written (1-page per role: student, lecturer, admin)
- [ ] API documentation (Swagger or equivalent)
- [ ] Thesis chapter on system design updated to match implemented system

**Screens affected:** All 18

**Acceptance criteria:**
- Zero critical accessibility failures
- All three user flows (student → lecturer → admin) completable end-to-end
- Response time < 1 second for similarity checks
- System gracefully degrades when SBERT is unavailable
- All email notifications deliver correctly
- Thesis supervisor can demo the system without errors

---

## Phase 7 — v2.0 Placeholders (or Implement if Time Permits)

**Goal:** Either finalize the placeholder screens or implement the analytics layer if the project timeline allows.

**Deliverables (placeholder — minimum):**
- [ ] L7 `/lecturer/research-trends` → renders friendly placeholder
- [ ] St5 `/student/research-explorer` → renders friendly placeholder
- [ ] A6 `/admin/reports` → renders friendly placeholder
- [ ] Placeholder includes: title, brief description, "Coming after first approval session" message, "Back to Dashboard" CTA

**Deliverables (full implementation — only if database has real session data):**
- [ ] L7 — Research Trends: My Overview donut + Department Trends charts + data tables
- [ ] St5 — Research Explorer: orientation row + recent topics browser + Inspire Me
- [ ] A6 — Reports: Zone 1 (department intelligence) + Zone 2 (system performance metrics) + export

**Screens affected:** L7, St5, A6

**Acceptance criteria (placeholder):**
- Routes return 200 with friendly content, not 404
- "Back to Dashboard" returns user to their role dashboard
- Nav items visible and not hidden

---

## Phase Summary

| Phase | Focus | Screens | Est. Complexity |
|---|---|---|---|
| 0 | Freeze MVP | None | Low |
| 1 | Foundation + layout | All (shell only) | Medium |
| 2 | Authentication | AUTH-01–03 | Medium |
| 3 | Student workflow | St1–St4 | High |
| 4 | Lecturer workflow | L1–L6 | High |
| 5 | Admin workflow | A1–A5 | High |
| 6 | Polish + testing | All 18 | Medium |
| 7 | v2.0 analytics | L7, St5, A6 | High (if implemented) |

---

*Source: `Feature-Scope-Full.md`, `02-FULL-PROJECT-BUILD-SCOPE.md`, all screen breakdown files*
