# 03 — Screen Inventory (Filtered)

> **Source:** `SDLC-Project/04-Design/UX/Screens/Screen-Inventory.md`, all screen breakdown files
> **Total screens: 21** (corrected from erroneous "23" — see `02-FULL-PROJECT-BUILD-SCOPE.md`)

---

## 🔐 Shared Auth Screens

---

### AUTH-01 — Login
**Route:** `/login` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Single entry point for all three roles. Detects user role on successful auth and routes silently to the correct dashboard — no role selection by the user.

**Core features:**
- Split panel — institution context left, form right
- Email + password fields
- Show/hide password toggle
- "Sign in" button with loading state
- Auth error banner (generic — does not reveal which field is wrong)
- "Forgot password?" link
- "Account access by invitation only" note — no self-registration
- Eyebrow label: "For Lecturers, Students and Administrators"

---

### AUTH-02 — Forgot Password
**Route:** `/forgot-password` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Lets a user request a password reset link to their `@uniosun.edu.ng` email.

**Core features:**
- Centered card layout (no split panel)
- University email input
- "Send reset link" button
- Confirmation state replaces form (echoes email address back, 30-min expiry note)
- "Send another reset link" option
- API always shows confirmation whether or not the email exists (prevents enumeration)
- "← Back to sign in" link

---

### AUTH-03 — Reset Password
**Route:** `/reset-password?token=...` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Lets a user with a valid reset token set a new password.

**Core features:**
- Centered card layout
- Token validated on page load — invalid token shows amber error state with "Request a new link" CTA
- New password + Confirm password fields with show/hide toggles
- Live requirement indicators (≥8 chars, contains number) — turn green as met
- "Set new password" button
- Success state replaces form: "Password updated" + "Go to sign in" CTA
- Token single-use, invalidated on success

---

## 👩‍🏫 Lecturer Screens

---

### L1 — Lecturer Dashboard
**Route:** `/lecturer/dashboard` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Home screen answering "what needs my attention right now?"

**Core features:**
- 3 summary stat cards: Pending Reviews, Approved This Session, Rejected This Session
- Concurrent review alert banner (conditional — only if Tier 3 has active alerts)
- Recent decisions feed — last 5, with topic title, outcome badge, timestamp
- "View All →" link to L4
- Quick Actions panel (right column):
  - "Check a Topic Now" → L5 (primary, filled green)
  - "Go to Pending Reviews" → L2 (secondary, outlined)

---

### L2 — Pending Reviews
**Route:** `/lecturer/pending-reviews` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Triage queue — scan all pending topics, select one to review.

**Core features:**
- View toggle: "My Assigned" (default) / "All Department" — with live counts
- Filter bar: Sort (Days Waiting default), Risk filter, Category filter, Search
- Topic table rows: title, student name, risk badge (🟢🟡🔴), days waiting (amber 7+ days, red 14+ days with row background tint)
- Clicking a row → full page L3
- Bulk action bar on selection: Export Selected only (no bulk approve)
- Pagination: 20 rows per page
- Empty states per view

---

### L3 — Similarity Results & Decision
**Route:** `/lecturer/pending-reviews/:topicId` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** The primary review screen — read evidence, make decision.

**Core features:**
- "← Back to Pending Reviews" breadcrumb (restores filters + scroll position)
- Topic header: student, date, full title, category
- Overall risk banner (🟢🟡🔴) with plain-language recommendation
- Algorithm score row: Jaccard | TF-IDF | SBERT with plain-English tooltips
- Three collapsible tier sections:
  - Tier 1 expanded by default, Tiers 2 + 3 collapsed with match count in header
  - Tier 1: 3-column card grid, max 5 cards, ranked highest similarity first
  - Tier 2: same card format
  - Tier 3: red alert format (not cards)
- Sticky decision panel at viewport bottom:
  - Approve → lightweight confirmation modal
  - Request Changes → modal with required guidance textarea (sent verbatim)
  - Reject → modal with required reason dropdown + optional notes (red confirm button)
- All decisions trigger email to student
- SBERT degraded mode: yellow banner, SBERT score shows N/A

---

### L4 — My Decisions
**Route:** `/lecturer/my-decisions` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Searchable record of all decisions made — for reference and dispute resolution.

**Core features:**
- Two-row filter bar: Date range + Outcome + Category + Risk (row 1), Student name search (row 2)
- Decisions table: topic, student, outcome badge, date, risk at submission
- Row click → inline summary card with: outcome, reason/feedback, risk badge, "View full similarity report ↓"
- Expanded report section: frozen snapshot (not live recalculation)
- Export: CSV + PDF (both respect active filters)

---

### L5 — Check Similarity
**Route:** `/lecturer/check-similarity` | **Version:** MVP → promote to v1.0 | **Priority:** Build Now

**Purpose:** Standalone ad-hoc similarity checker not tied to any submission.

**Core features:**
- Topic textarea: 7–24 words, 50–180 chars, live counter + progress bar
- Category dropdown (optional)
- "Check Similarity" button (disabled when input out of range)
- Results below input card (input stays visible and editable above)
- Auto-scroll to results on completion
- Full results: risk banner, algorithm scores (Jaccard/TF-IDF/SBERT with tooltips), all three tier sections
- No decision panel
- SBERT degraded mode: yellow warning banner, SBERT shows N/A
- "Check another topic" resets inline
- 4 states: Empty, LOW risk, HIGH risk, Degraded

---

### L6 — Supervisees
**Route:** `/lecturer/supervisees` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Mentorship overview of all assigned students and their submission progress.

**Core features:**
- Summary stat row: total students, counts per status
- Status filter pills: All / Pending / Approved / Awaiting Revision / Not Submitted / Rejected
- Student rows: name + status badge, chevron
- Row click → inline submission panel:
  - If submitted: title, date, risk at submission, status, feedback, "View full similarity report →"
  - If not submitted: "This student has not submitted yet"
- One panel open at a time
- Empty state: "No students assigned yet"

---

### L7 — Research Trends
**Route:** `/lecturer/research-trends` | **Version:** v2.0 | **Priority:** Placeholder only

**Purpose:** Strategic intelligence — discipline saturation, trends, keyword clusters. Requires populated database.

**Core features (design complete, build deferred):**
- Time range selector (default: last 3 sessions)
- My Overview zone: personal supervised topics stats, donut chart by discipline
- Department Trends zone: discipline heatmap, temporal trends, underexplored areas, keyword clusters
- Cross-filter by discipline
- Data tables below each chart
- Export: CSV + PDF

**Implementation now:** Render a placeholder: "Research Trends will be available after the first approval session."

---

## 🎓 Student Screens

---

### St1 — Student Dashboard
**Route:** `/student/dashboard` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Home screen — "what is happening with my topic right now?"

**Core features:**
- Active Topic Status card (most urgent submission by priority: Awaiting Revision → Pending → Rejected → Approved)
- Status-specific content: badge, message, CTA (Revise / none / View details)
- Multiple submissions at same priority: indicator with "View all →" to St3
- Empty state (no submissions): onboarding prompt with two CTAs
- Left: Notifications feed — last 5 events
- Right: Quick Actions — "Submit New Topic" + "Check My Topic" (present in all states)
- 4 states: Awaiting Revision, Pending Decision, Approved, Empty

---

### St2 — Submit Topic
**Route:** `/student/submit-topic` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Formal 3-step submission flow.

**Core features:**
- Breadcrumb progress indicator: "Enter Topic → Pre-check → Confirm" (not clickable)
- Step 1 — Enter Topic: textarea (7–24 words), category (required), supervisor (required), keywords (optional), "Save Draft" + "Next →"
- Step 2 — Pre-check Results: form replaced by simplified D26 results (risk banner + single combined score + Tier 1 cards only — no algorithm scores, no Tier 2/3). HIGH risk: button hierarchy swaps ("← Revise my topic" primary, "Submit anyway →" secondary). Student never blocked.
- Step 3 — Confirm: submission summary card + "Submit for Review" button
- Back at every step restores data intact
- On submit success: navigate to St3 with submission auto-expanded
- "Save as draft?" prompt if navigating away mid-flow
- 4 states: Step 1 empty, Step 2 LOW/MEDIUM, Step 2 HIGH risk, Step 3 confirm

---

### St3 — My Submissions
**Route:** `/student/my-submissions` | **Version:** v1.0 | **Priority:** Build Now
**Deep link:** `/student/my-submissions?submission=abc123`

**Purpose:** Complete record of all submissions — statuses, feedback, revision history.

**Core features:**
- Expandable rows — inline panel below, one open at a time
- Panel content varies by status: Awaiting Revision shows feedback + "Revise and Resubmit →"; Approved shows approval date; Pending shows reassurance; Rejected shows reason + "Start a new topic →"
- "View similarity report" → frozen D26 snapshot inline (no algorithm scores, no Tier 2/3)
- Revision history thread: original + revised under one parent row (depth cap: current + 1 previous)
- Email deep link (D28): auto-expands specified submission on load, yellow banner briefly shown
- Empty state: "No submissions yet" with two CTAs
- 5 states: Awaiting Revision, Approved, Pending Decision, Empty, Email deep link auto-expanded

---

### St4 — Check My Topic
**Route:** `/student/check-my-topic` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Informal standalone pre-submission checker — can be used any number of times.

**Core features:**
- Topic textarea + category dropdown (optional) + "Check My Topic" button
- Results below input (input stays visible and editable above)
- Simplified D26 results: risk banner (plain language) + single combined score + Tier 1 cards only
- No algorithm scores, no Tier 2, no Tier 3, no decision panel
- CTA after results: LOW/MEDIUM = "Looks good? Submit this topic →" (pre-fills St2); HIGH = "Revise my topic" primary + "Submit anyway →" small secondary
- SBERT degraded: yellow warning banner above card, "Results are incomplete" note
- "Check another topic" resets inline
- 4 states: Empty, LOW risk, HIGH risk, Degraded

---

### St5 — Research Explorer
**Route:** `/student/research-explorer` | **Version:** v2.0 | **Priority:** Placeholder only

**Purpose:** Discovery screen — what is popular, what is saturated, where are the gaps.

**Core features (design complete, build deferred):**
- Orientation row: word cloud + discipline donut chart + underexplored areas panel
- Recent approved topics browser with inline expandable detail
- "Check a topic like this →" CTA links to St4
- "Inspire Me" button
- Cross-filter by discipline

**Implementation now:** Placeholder: "Research Explorer will be available after the first approval session."

---

## 🛠️ Admin Screens

---

### A1 — Admin Dashboard
**Route:** `/admin/dashboard` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** System health and activity overview.

**Core features:**
- System health cards row (always visible): API / Database / SBERT — green/amber/red
- Conditional alert banner (only when degraded/down): names service, describes impact, links to A5
- Left: Usage stats — Active Users Today, Topics Submitted, Similarity Checks Run
- Right: Recent activity feed — last 10 events with event type badges
- 3 states: All healthy, SBERT degraded (amber), Critical DB down (red, stats show "—")

---

### A2 — User Management
**Route:** `/admin/user-management` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Create, edit, suspend, delete all user accounts across all three roles.

**Core features:**
- Role filter tabs with live counts: All / Lecturers / Students / Admins
- Search + "Add User" button
- Add User modal: Name, Email, Role dropdown, Send invite checkbox
- Users table: name, email, role badge, status
- Three-dot menu per row: Edit Role (neutral) / Suspend (amber) / Delete (red + confirmation)
- Bulk: Suspend Selected
- Export Users CSV
- 3 states: Populated all users, Filtered Lecturers tab, Add User modal open

---

### A3 — Topic Repository
**Route:** `/admin/topic-repository` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Data quality engine — browse, import, clean, migrate the historical topic database.

**Core features:**
- Action bar: Import CSV/Excel, Manual Entry, Find Duplicates, End-of-Session Migration
- Import wizard modal (4 steps): Upload → Column Mapping → Validation Preview → Confirm
- Topics table with filter bar: Year, Category, Source, Status
- Find Duplicates results panel below table: pairs side by side with Keep Left / Keep Right / Mark as Distinct / Archive Both
- Empty state with import CTA
- 4 states: Populated, Import modal (Step 1), Duplicates panel, Empty

---

### A4 — System Settings
**Route:** `/admin/system-settings` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Configuration control for all operational parameters.

**Core features:**
- Left sidebar tabs (200px fixed): Similarity Thresholds / Discipline Categories / Email Templates / Session Configuration
- Amber unsaved dot in sidebar next to section name when changes pending
- Thresholds section: sliders for LOW/MEDIUM/HIGH cutoffs. Historical design examples mention 30%/60%, but final defaults are pending confirmation and must not be changed without a dedicated settings/threshold PR.
- Categories section: add/rename/reorder the 8 disciplines
- Email Templates section: selector + editable textarea + "Send Test Email" per template
- Session Config: session name + date range
- Save button per section (greyed when clean, green when pending)
- Unsaved changes warning when navigating away
- 3 states: Thresholds active, Email Templates active, Unsaved changes warning

---

### A5 — Audit Log
**Route:** `/admin/audit-log` | **Version:** v1.0 | **Priority:** Build Now

**Purpose:** Full timestamped accountability record for dispute resolution and NUC accreditation.

**Core features:**
- Filter bar: Date range, Event Type, User search
- Log table: timestamp, user, event type badge, detail summary
- Row click → inline detail panel (variable depth by event type):
  - Topic Decision: full read-only similarity snapshot + decision + reason
  - Threshold Change: before/after values
  - Login: IP + browser
  - Import: file name + records in/skipped/error
  - User Action: who affected, what done
- One panel open at a time
- Export Log CSV
- 3 states: Populated, Filtered decisions only, Row expanded (decision event)

---

### A6 — Reports
**Route:** `/admin/reports` | **Version:** v2.0 | **Priority:** Placeholder only

**Purpose:** Department analytics and system performance reporting for NUC accreditation.

**Core features (design complete, build deferred):**
- Zone 1: Department research intelligence (discipline heatmap, temporal trends, supervisor activity non-anonymised, keyword clusters)
- Zone 2: System performance metrics (duplicate catch rate, algorithm performance, approval pipeline, first-attempt approval rate)
- Session filter
- Export: CSV + PDF (NUC-formatted)

**Implementation now:** Placeholder: "Reports will be available after the first approval session."

---

*Source: All screen breakdown files in `SDLC-Project/04-Design/UX/Screens/`*
