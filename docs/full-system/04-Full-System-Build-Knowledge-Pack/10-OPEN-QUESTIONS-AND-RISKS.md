# 10 — Open Questions and Risks

> **Purpose:** Unresolved questions, missing decisions, contradictions, and implementation risks. Review before starting each phase.
> **Convention:** Items marked ✅ are resolved. Items marked ❓ need confirmation before building. Items marked ⚠️ are risks to monitor.

---

## Documentation Issues (Resolved)

### ✅ Screen count discrepancy
**Issue:** One earlier document stated "Total screens: 23" but the actual breakdown adds up to 21.
**Resolution:** Corrected to 21 in `Screen-Inventory.md` and `02-FULL-PROJECT-BUILD-SCOPE.md`. The "23" figure appeared only in a chat response — no vault file contains it. Use 21 everywhere.

---

## Authentication and Access

### ❓ Password complexity requirements
**Issue:** The vault states password complexity requirements exist but does not specify them beyond "≥8 characters and contains a number" (from AUTH-03 Reset Password spec).
**Impact:** Backend validation rules and AUTH-03 UI requirement indicators need to be consistent.
**Recommended resolution:** Minimum 8 characters, at least 1 number, at least 1 uppercase letter. Confirm with project supervisor before implementing.

### ❓ JWT storage method
**Issue:** The vault specifies JWT authentication but does not lock in whether tokens are stored in httpOnly cookies or localStorage.
**Impact:** Security implications differ significantly. httpOnly cookies are safer (XSS-resistant) but require CORS configuration. localStorage is simpler but vulnerable to XSS.
**Recommended resolution:** Use httpOnly cookies for production. For thesis demo, localStorage with short expiry (1 hour) is acceptable if HTTPS is enforced.

### ❓ Session timeout duration
**Issue:** Not documented. How long before an authenticated session expires?
**Recommended resolution:** 24-hour JWT expiry for a university tool where users log in once per day. Needs confirmation.

### ❓ Account lockout after failed logins
**Issue:** Feature Scope Full mentions "account lockout after failed login attempts" but the number of attempts is not specified.
**Recommended resolution:** 5 failed attempts → 15-minute lockout. Confirm before implementing.

---

## Submission Workflow

### ❓ Maximum submissions per student per session
**Issue:** Not documented. Can a student submit multiple topics simultaneously, or one at a time?
**Impact:** Affects submission table design, dashboard active topic logic (D29 priority system assumes multiple possible), and the revision thread pattern in St3.
**Likely answer:** One active submission at a time (the `parent_id` field on `submissions` handles revision threads). But a student whose topic is rejected may start a completely new submission. Needs confirmation.

### ❓ Who can assign supervisors to students?
**Issue:** The system has a `supervisor_assignments` table and a supervisor dropdown in St2, but it is not documented who creates these assignments.
**Options:** (a) Admin pre-assigns supervisors to students before the session starts, (b) Students choose their preferred supervisor when submitting, (c) Both.
**Needs confirmation:** The vault implies students choose during submission (St2 has a supervisor dropdown). But L6 Supervisees implies pre-assignment exists. Both may coexist.
**Risk:** If pre-assignments are required before submission, the admin must do this as a setup step — it needs to be in the Phase 5 admin workflow.

### ❓ Can a topic be resubmitted after rejection?
**Issue:** The vault shows a "Start a new topic →" CTA on rejected submissions in St3, implying the student starts fresh. But is a rejection a hard block or can the student revise and resubmit the same topic?
**Likely answer:** Rejection is different from "Request Changes" — rejection means start fresh. But this needs confirmation because it affects the `parent_id` logic in the `submissions` table.

### ❓ What happens if a student has multiple submissions awaiting revision?
**Issue:** D29 says the dashboard shows the most urgent submission. The "multiple submissions indicator" appears "You have N submissions awaiting revision". But the system allows a student to have multiple active submissions?
**Needs clarification:** See maximum submissions question above.

---

## Similarity Engine

### ❓ Tier 2 scope — "current session" definition
**Issue:** Tier 2 checks against topics approved in the current session. But what defines "current session"? Is it the `academic_sessions.is_current = true` record?
**Likely answer:** Yes — queries `current_session_topics` where `session_id = (SELECT id FROM academic_sessions WHERE is_current = true)`.
**Confirm before implementing Tier 2 in Phase 4.**

### ❓ Tier 3 concurrent review window
**Issue:** Tier 3 detects topics being reviewed simultaneously. The vault says "concurrent reviews in the last 48 hours" in the empty state message. But what triggers a topic to enter `under_review_topics`?
**Likely answer:** When a lecturer opens L3 for a topic (page load), insert into `under_review_topics`. When they make a decision (or close L3), delete from `under_review_topics`. The 48-hour window is a cleanup cutoff.
**Risk:** If a lecturer opens L3 and closes their browser without deciding, the record stays in `under_review_topics` indefinitely. Need a cleanup job or TTL mechanism.
**Recommended resolution:** Add `expires_at = NOW() + INTERVAL '48 hours'` to `under_review_topics` and filter by `expires_at > NOW()` in Tier 3 queries.

### ⚠️ SBERT service cold start
**Risk:** The SBERT Python service on Render free tier goes to sleep after 15 minutes of inactivity. The first request after sleep takes 30–60 seconds to respond (cold start). This will cause the similarity check to time out or appear broken.
**Mitigation options:**
1. Upgrade Render to a paid plan (no sleep)
2. Implement a health ping every 10 minutes to keep the service warm
3. Show a loading message: "Semantic analysis starting up... this may take a moment" on first check after inactivity
**Recommended:** Option 2 (health ping) + Option 3 (user-facing message). Confirm before Phase 4.

### ⚠️ pgvector performance on Neon free tier
**Risk:** Neon free tier has limited compute. SBERT similarity queries using vector cosine distance across 2,000+ topics may be slow.
**Mitigation:** Add an IVFFlat or HNSW index on the `embedding` column.
```sql
CREATE INDEX ON historical_topics USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```
**Add this index during Phase 1 database setup.**

---

## Admin Workflow

### ❓ CSV/Excel import — required column names
**Issue:** The import wizard (A3) has a column mapping step. But what are the exact required field names the system expects?
**Likely required fields:** Topic Title, Year, Category, Supervisor
**Optional fields:** Keywords, Source, Notes
**Needs confirmation:** A template CSV should be downloadable from A3 so admins know the expected format.

### ❓ End-of-session migration — what happens to rejected topics?
**Issue:** The migration moves approved current session topics to historical. What happens to rejected or pending topics at session end?
**Likely answer:** Rejected topics are archived (not migrated). Pending topics should prompt a warning before migration ("You have X pending topics. Migrate anyway?").
**Needs confirmation before implementing Phase 5.**

### ❓ Email service provider
**Issue:** The vault specifies email notifications are needed but does not specify the email service provider.
**Options:** Resend (recommended — simple API, generous free tier), Nodemailer + SMTP (works with Gmail or university SMTP), SendGrid.
**Recommended:** Resend for development and thesis demo. Confirm before Phase 2.

### ❓ Admin email template variables
**Issue:** Admin can edit email templates in A4. But what template variables are available (e.g. `{{studentName}}`, `{{topicTitle}}`, `{{supervisorName}}`)?
**Needs documentation:** Define the available variables for each template type before Phase 5.

---

## Frontend

### ⚠️ L3 back navigation state preservation
**Risk:** "← Back to Pending Reviews" must restore L2's exact state (view toggle, filters, scroll position). This is non-trivial in React if the component unmounts on navigation.
**Recommended approach:** Store L2 filter state in URL query params (`?view=assigned&sort=waiting&risk=HIGH`) so the state is preserved in the URL and restored on back navigation automatically.
**Implement in Phase 4.**

### ❓ Real-time updates
**Issue:** The vault mentions real-time count updates on L2 view toggle and Tier 3 concurrent review detection. Does this require WebSockets or is polling sufficient?
**Vault says:** "polling is sufficient for concurrent review alerts" — WebSockets are explicitly out of scope.
**Resolution:** Use polling (every 30–60 seconds) for concurrent review status. No WebSocket implementation needed.

### ⚠️ Mobile warning banner
**Issue:** The vault says screens below 768px should show "⚠️ Best viewed on desktop + [Continue Anyway]". But the student audience includes mobile-first users (per the persona doc).
**Risk:** Blocking or warning mobile students may frustrate users who only have smartphones.
**Recommended:** Keep the banner as designed but make it dismissible and non-blocking. "Continue Anyway" must actually continue — not just close the banner and break the layout.

---

## Data and Privacy

### ❓ Real UNIOSUN historical topic data
**Issue:** The MVP uses 60 sample topics. The full system needs the real UNIOSUN historical topic database for similarity checking to be meaningful.
**Status:** Not yet imported. Admin must import via A3 after Phase 5.
**Risk:** If the real data is not available at thesis defense, the similarity engine will be checked against sample data only — this may reduce demonstration credibility.
**Action needed:** Obtain real departmental topic records before Phase 6.

### ❓ Student privacy in Research Explorer (St5) and Reports (A6)
**Issue:** The vault states St5 shows topic titles but never student names. A6 shows named lecturers. Are there any institutional privacy rules that restrict what can be shown?
**Likely answer:** For a university system, showing approved topic titles without student names is acceptable. Showing lecturer names in A6 is acceptable for admin oversight.
**Confirm with department before implementing v2.0 screens.**

---

## Deployment

### ⚠️ Render free tier limitations
**Risk:** Render free tier instances spin down after 15 minutes of inactivity. Both the Node backend and Python SBERT service are affected.
**Impact:** Cold starts cause 30–60 second delays for the first request after inactivity.
**Mitigation:** Health ping service (cron or external uptime monitor) to keep instances warm.

### ❓ Environment variables for production
**Issue:** Full list of required environment variables not consolidated in one place.
**Needed:**
```
DATABASE_URL          (Neon PostgreSQL connection string)
JWT_SECRET            (random 256-bit string)
SBERT_SERVICE_URL     (Render Python service URL)
RESEND_API_KEY        (email service)
FRONTEND_URL          (Vercel URL — for CORS and email links)
NODE_ENV              (production)
```
**Create `.env.example` in Phase 0.**

---

## Risks Summary

| Risk | Severity | Phase | Mitigation |
|---|---|---|---|
| SBERT cold start delays | High | 4 | Health ping + loading message |
| pgvector slow on Neon free tier | Medium | 1 | Add IVFFlat index |
| Tier 3 stale `under_review_topics` | Medium | 4 | Add TTL / expires_at |
| L3 back navigation state loss | Medium | 4 | Use URL query params for L2 state |
| Real topic data not available at defense | High | 6 | Obtain data early |
| Render backend cold starts | High | 2 | Health ping service |
| Mobile usability (student persona) | Medium | 6 | Make warning banner dismissible |
| Multiple active submissions per student | Low | 3 | Confirm business rule |
| Supervisor assignment workflow unclear | Medium | 3 | Confirm who creates assignments |

---

*Source: All vault design files, design decisions D1–D60, `Phase-3A-System-Architecture-Backend-Design.md`*
*Last updated: 2026-04-02*
