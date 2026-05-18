# 04 — Role-Based Workflows

> **Source:** `Student-Submission-Workflow.md`, `Lecturer-Approval-Workflow.md`, all screen breakdown files, design decisions D1–D60

---

## Workflow 1 — Student Checks Topic Informally (St4)

**Trigger:** Student navigates to "Check My Topic" or clicks the dashboard CTA.

1. Student opens St4 — Check My Topic
2. Enters topic text (7–24 words, 50–180 chars) in textarea
3. Live word/character counter + progress bar updates in real time
4. Optionally selects a discipline category
5. Clicks "Check My Topic" — button disabled if input out of range
6. System calls `POST /api/v1/check-similarity` with topic text + optional category
7. Backend runs Jaccard + TF-IDF + SBERT in parallel (or Jaccard + TF-IDF only if SBERT down)
8. Results appear below the input card — page auto-scrolls to results
9. Student sees: risk banner (plain language), single combined score %, Tier 1 match cards with matched keywords
10. Student does NOT see: algorithm scores, Tier 2, Tier 3, decision panel
11. If LOW or MEDIUM: CTA "Looks good? Submit this topic →" — navigates to St2 Step 1 with topic pre-filled
12. If HIGH: CTA "Revise my topic" (primary) — clears input for revision. "Submit anyway →" available as small secondary.
13. If SBERT down: yellow warning banner above card, "Results are incomplete. Your lecturer will run a full check."
14. "Check another topic" — resets inline without page reload

---

## Workflow 2 — Student Submits Topic Formally (St2)

**Trigger:** Student clicks "Submit New Topic" from St1 dashboard, or "Submit This Topic →" from St4.

### Step 1 — Enter Topic
1. Student opens St2 — Submit Topic (Step 1 active in breadcrumb)
2. Enters topic text (7–24 words required)
3. Selects discipline category (required)
4. Selects preferred supervisor from dropdown (required)
5. Optionally adds keywords
6. "Save Draft" saves without advancing. "Next →" advances to Step 2.
7. If navigating away without saving: "Save as draft?" prompt

### Step 2 — Pre-check Results
1. Clicking "Next →" automatically runs `POST /api/v1/check-similarity`
2. Button shows "Checking..." with spinner while request is in flight
3. Form is replaced by results view — topic shown as read-only summary at top
4. Simplified results display (same as St4 — D26 rules apply)
5. If LOW/MEDIUM: "Proceed to submit →" (primary) + "← Back to edit topic" (secondary)
6. If HIGH: "← Revise my topic" (primary, green — recommended action) + "Submit anyway →" (secondary, outlined)
7. Student is NEVER blocked — they can always proceed despite HIGH risk
8. Clicking "← Back" restores Step 1 with all data intact

### Step 3 — Confirm and Submit
1. Student sees summary: topic title, category, supervisor, risk level from Step 2
2. Reads submission note: "Your topic will enter Dr. [Supervisor]'s review queue..."
3. Clicks "Submit for Review" — button shows "Submitting..." with spinner
4. Backend creates submission record in database with status = "Pending Review"
5. System sends confirmation email to student
6. Student navigated to St3 with new submission auto-expanded
7. Submission status visible: "Pending Review"

---

## Workflow 3 — Lecturer Reviews a Pending Topic (L2 → L3)

**Trigger:** Lecturer opens "Pending Reviews" from nav or "Go to Pending Reviews" from L1.

1. Lecturer lands on L2 — Pending Reviews
2. Default view: "My Assigned" tab, sorted by Days Waiting (longest first)
3. Lecturer scans the table — risk badges and days waiting visible per row
4. Optionally filters by risk level, category, or searches by topic/student name
5. Clicks a topic row → navigates to L3 (full detail page)
6. L3 loads: topic header, risk banner, algorithm scores, three tier sections
7. Tier 1 expanded by default (top 5 historical matches in 3-col card grid)
8. Tier 2 and Tier 3 collapsed — lecturer can expand if counts show matches
9. Lecturer reads tier cards, matched keywords, algorithm scores with tooltips
10. Sticky decision panel always visible at viewport bottom throughout scroll

---

## Workflow 4 — Lecturer Approves a Topic

**Trigger:** Lecturer clicks "✅ Approve" in the sticky decision panel on L3.

1. Approve modal opens over the page (evidence still visible behind)
2. Modal shows: "Approve this topic?" + student name + full topic title
3. Lecturer clicks "Approve" (primary green button)
4. System records decision in database: outcome = "Approved", timestamp, deciding lecturer
5. Topic status updates to "Approved" in all tables
6. System sends approval email to student
7. Event recorded in audit log
8. Modal closes, lecturer returned to L2 queue

---

## Workflow 5 — Lecturer Requests Changes

**Trigger:** Lecturer clicks "🔄 Request Changes" in the sticky decision panel on L3.

1. Request Changes modal opens
2. Modal shows topic title for reference
3. Lecturer types specific guidance in required textarea (min 20 characters)
4. Character counter shown live
5. "Send request" button disabled until textarea has ≥20 chars
6. Lecturer clicks "Send request"
7. System records decision: outcome = "Modification Requested", guidance text, timestamp, deciding lecturer
8. Topic status updates to "Awaiting Revision"
9. System sends email to student with guidance text verbatim
10. Event recorded in audit log
11. Modal closes, lecturer returned to L2 queue

---

## Workflow 6 — Lecturer Rejects a Topic

**Trigger:** Lecturer clicks "❌ Reject" in the sticky decision panel on L3.

1. Reject modal opens
2. Modal shows topic title for reference
3. Lecturer selects reason from required dropdown:
   - "Too similar to existing topic"
   - "Outside scope of department research"
   - "Topic requires significant rework"
   - "Duplicate of currently approved topic"
   - "Other"
4. Optionally adds additional notes in textarea
5. "Reject topic" button (red) disabled until reason is selected
6. Lecturer clicks "Reject topic"
7. System records decision: outcome = "Rejected", reason, notes, timestamp, deciding lecturer
8. Topic status updates to "Rejected"
9. System sends rejection email to student with reason and any notes
10. Event recorded in audit log
11. Modal closes, lecturer returned to L2 queue

---

## Workflow 7 — Admin Imports Historical Topics (A3)

**Trigger:** Admin navigates to "Topic Repository" and clicks "Import CSV/Excel".

1. Admin opens A3 — Topic Repository
2. Clicks "Import CSV/Excel" in the action bar
3. Import wizard modal opens — Step 1: Upload
4. Admin drags file or uses file picker (CSV or Excel accepted)
5. File validates on upload (type check, size limit)
6. Step 2: Column Mapping
   - System attempts auto-map (matches column headers to system fields)
   - Admin confirms or corrects mapping for: Topic Title, Category, Year, Supervisor
   - Required fields flagged if unmapped
7. Step 3: Validation Preview
   - Preview table shows: green rows (ready), amber (warnings), red (errors/missing required)
   - Admin can proceed with valid rows only — errors do not block import of clean rows
8. Step 4: Confirm Import
   - Summary: "X records ready, Y will be skipped"
   - Admin clicks "Confirm Import"
   - Progress indicator shown during import
   - On completion: "X topics imported successfully. Y skipped. [View imported topics →]"
9. Import event recorded in audit log with file name, counts, admin name, timestamp

---

## Workflow 8 — Admin Manages Users (A2)

### Add a user
1. Admin opens A2 — User Management
2. Clicks "+ Add User"
3. Add User modal: fills Name, Email, Role (Lecturer/Student/Admin), checks "Send invite email"
4. Clicks "Send Invite"
5. System creates account, sends invite email with password setup link
6. New user row appears in table with "Active" status
7. Event recorded in audit log

### Suspend a user
1. Admin clicks three-dot menu on a user row
2. Selects "Suspend" (amber)
3. User status changes to "Suspended" — they can no longer log in
4. Event recorded in audit log

### Delete a user
1. Admin clicks three-dot menu on a user row
2. Selects "Delete" (red)
3. Confirmation modal: "Are you sure? This cannot be undone."
4. Admin confirms — user account permanently deleted
5. Event recorded in audit log

### Edit a user's role
1. Admin clicks three-dot menu on a user row
2. Selects "Edit Role"
3. Role dropdown appears — admin selects new role
4. Saves — user's permissions update immediately
5. Event recorded in audit log

---

## Workflow 9 — Admin Reviews Audit Log (A5)

**Trigger:** Admin opens "Audit Log" from nav, or follows "View error logs →" from A1 alert banner.

1. Admin lands on A5 with last 30 days of events, all types
2. Optionally filters by:
   - Date range (narrow to specific period)
   - Event Type (e.g. "Topic Decisions" for dispute review, "Threshold Changes" for integrity review)
   - User (find all actions by a specific lecturer or student)
3. Scans the log table
4. Clicks a row to expand inline detail panel
5. For a topic decision event: sees full read-only similarity report snapshot + decision outcome + reason + timestamp + deciding lecturer name
6. Uses this as evidence during dispute resolution or NUC accreditation review
7. Exports log as CSV for external submission if needed

---

## Workflow 10 — System Sends Notification Emails

**Triggers and email content:**

| Trigger | Recipient | Subject | Content |
|---|---|---|---|
| Topic submitted | Student | "Topic received" | Confirmation, assigned supervisor, "Pending Review" status |
| Topic approved | Student | "Topic approved" | Congratulations, approval date |
| Topic rejected | Student | "Topic rejected" | Reason selected by lecturer, any additional notes |
| Modification requested | Student | "Changes requested for your topic" | Lecturer's guidance text verbatim |
| Account created | New user | "Your UNIOSUN Research Portal account" | Invite link for password setup |

All email content is configurable by admin in A4 System Settings → Email Templates section.

---

## Workflow 11 — End-of-Session Migration (A3)

**Trigger:** Admin runs this at the end of each academic session.

1. Admin opens A3 — Topic Repository
2. Clicks "End-of-Session Migration → Historical" in action bar
3. Confirmation modal: "This will move all approved topics from the current session into the historical database. This action cannot be undone."
4. Admin confirms
5. System moves all current_session_topics with status = "Approved" to historical_topics table
6. Under_review_topics table is cleared
7. Current session effectively reset for next academic year
8. Migration event recorded in audit log with counts

---

*Source: `Student-Screen-Decisions.md`, `L2-Pending-Reviews-Screen.md`, `L3-Similarity-Results-Screen.md`, `Admin-Screen-Decisions.md`*
