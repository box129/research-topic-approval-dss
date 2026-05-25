# Lecturer My Decisions Implementation Plan

## Overview

The **Lecturer My Decisions** page enables lecturers to view a historical record of all decisions (approvals, rejections, requested revisions) made during the current session. This page serves as an audit trail and decision repository, supporting quick searches, filtering by outcome/risk/category, and inline expansion to view decision rationale, similarity snapshots, and feedback threads.

**Page Route:** `/lecturer/my-decisions`

**v1.0 Classification:** Core feature — required for initial lecturer feature delivery

---

## Screen/State Summary

### State 1: Decisions Overview List (Default)
- **Purpose:** Display a paginated list of all decisions made by the lecturer in the current session
- **Role:** Lecturer
- **Key Interactions:**
  - View decision records in a table/list format
  - Filter by date range, outcome (Approved/Rejected/Requested Changes), risk level, or category
  - Search by topic title or student name
  - Select a decision row to expand details inline
  - Export decision records (v2.0 optional)
  - Navigate through pages of decisions using pagination controls
- **Visual Style:** Compact table-style list with status badges (green for Approved, red for Rejected, amber for Requested Changes), risk chips, and clear column headers
- **Data State:** Non-empty list of decisions with at least one record

### State 2: Decision Detail Expansion (Inline)
- **Purpose:** Display expanded details for a selected decision, including decision notes, similarity snapshot, and feedback history
- **Role:** Lecturer
- **Key Interactions:**
  - View two-column detail layout: left = decision notes and timeline, right = similarity snapshot and view full report CTA
  - See decision rationale notes entered by the reviewer
  - Review a historical similarity snapshot (showing scores at time of decision)
  - Browse feedback thread and activity timeline
  - Return to list view by collapsing or navigating away
- **Visual Style:** Expanded row or side panel with green approved card example; historical snapshot callout explaining that data reflects the analysis performed at decision time
- **Data State:** A specific decision row is selected and expanded; similarity data is read-only and historical

### State 3: Empty Decisions State
- **Purpose:** Inform the lecturer that no decisions have been recorded yet in the current session
- **Role:** Lecturer
- **Key Interactions:**
  - See friendly empty state messaging
  - Access a CTA to view pending reviews or similarity results
  - Filter and export controls are disabled
- **Visual Style:** Large dashed placeholder area with icon and message "No decisions recorded yet"
- **Data State:** Zero decision records returned from the backend

---

## v1.0 Implementation Priority

| State | Priority | Rationale |
|-------|----------|-----------|
| Decisions Overview List | **High** | Enables lecturers to audit their own decision history; essential for accountability and workflow transparency |
| Decision Detail Expansion | **High** | Provides decision rationale and historical context; critical for supporting lecturer workflows and appeal/clarification requests |
| Empty Decisions State | **High** | Graceful fallback when no decisions exist; prevents confusing blank screens and guides users to next actions |

**All three states are v1.0** because they form a cohesive feature and support the core lecturer decision-audit workflow.

---

## Component Breakdown

### Shared Layout & Navigation
- **LecturerDashboardLayout** — Main layout wrapper for the lecturer dashboard area (header nav, sidebar, footer)
- **PageHeader** — Page title, optional breadcrumb, and intro text for Lecturer My Decisions

### Core List Components
- **DecisionHistoryList** — Reusable container/wrapper for the full decisions list
- **DecisionTable** — Table component with columns for decision metadata (if table-style is used; alternative: list of DecisionCard rows)
- **DecisionCard** — Individual decision row component showing: topic title, student name/id, outcome badge, decision date, risk badge, and expand icon
- **PaginationControls** — Navigation controls (prev/next, page indicators, items-per-page selector) for large decision lists

### Decision Detail Components
- **DecisionDetailsPanel** — Two-column layout container: left column for notes/timeline, right column for snapshot/report links
- **LecturerFeedbackPanel** — Reusable panel displaying decision notes, feedback text, and reviewer name/date
- **ActivityTimeline** — Timeline component showing decision history (submitted → reviewed → decided → feedback sent, etc.)
- **SimilarityResultPanel** — Historical snapshot of similarity analysis results (read-only, reference data)
- **SimilarTopicCard** — Individual match card from the historical similarity report (if multiple matches existed at decision time)

### Filtering & Search
- **FilterDropdown** — Reusable dropdown for filter options (date range, outcome, risk level, category)
- **SearchInput** — Text input for searching by topic title or student name

### Status & Visual Indicators
- **StatusBadge** — Shows decision outcome (Approved, Rejected, Requested Changes) with appropriate colors
- **RiskBadge** — Shows risk level (Low, Medium, High) with appropriate colors and icons
- **InfoCallout** — Informational box explaining historical snapshot, decision rationale, or next steps

### Empty State & Actions
- **EmptyStatePanel** — Centered placeholder with icon, message, and optional CTA buttons
- **PrimaryButton** — Main action button (e.g., "View Pending Reviews", "Check Similarity Results")
- **SecondaryButton** — Secondary action or cancel buttons

---

## Route & State Mapping

### Single Route, Multiple States
- **Route:** `/lecturer/my-decisions`
- **Default State:** Decisions Overview List (fetches all decisions, applies any saved filters)
- **Expansion State:** User clicks a decision row → detail panel expands inline or in a side panel (no new route navigation needed)
- **Empty State:** Controlled by API response — if decision array is empty, render EmptyStatePanel instead of DecisionTable/DecisionCard list

### State Transitions
```
/lecturer/my-decisions (default list view)
  ↓ (user clicks a decision row)
→ Inline expansion or side panel opens (decision detail view)
  ↓ (user clicks back/collapse)
→ Returns to list view
  
If no decisions returned by API:
→ Shows empty state with CTAs to pending reviews or similarity check
```

### Query Parameters (Optional)
- `?page=1` — Current page number (defaults to 1)
- `?limit=20` — Items per page (defaults to 20)
- `?filterOutcome=approved` — Filter by outcome (approved, rejected, requested_changes)
- `?filterRisk=high` — Filter by risk level (low, medium, high)
- `?filterCategory=epidemiology` — Filter by category
- `?search=keywords` — Search query (applies to topic title, student name)

---

## Backend/API Dependency Notes

### Required Endpoints

#### 1. Fetch Current Lecturer Profile
- **Endpoint:** `GET /api/lecturers/me`
- **Purpose:** Identify the current lecturer and associate decisions with them
- **Response Fields:** lecturer_id, name, email, department

#### 2. Fetch Decisions for Current Lecturer
- **Endpoint:** `GET /api/lecturers/me/decisions?page=1&limit=20` (with optional filters)
- **Purpose:** Retrieve paginated list of decisions made by the lecturer
- **Query Parameters:**
  - `page` (integer) — Page number (1-indexed)
  - `limit` (integer) — Items per page
  - `filterOutcome` (string) — approved | rejected | requested_changes (optional)
  - `filterRisk` (string) — low | medium | high (optional)
  - `filterCategory` (string) — Category name (optional)
  - `filterDateFrom` (ISO 8601 date) — Start of date range (optional)
  - `filterDateTo` (ISO 8601 date) — End of date range (optional)
  - `search` (string) — Search query for topic/student name (optional)
- **Response Shape:**
  ```json
  {
    "data": [
      {
        "decision_id": "dec-001",
        "topic_id": "topic-123",
        "topic_title": "Epidemiological Trends in COVID-19",
        "student_id": "stud-456",
        "student_name": "Alice Johnson",
        "outcome": "approved",
        "decision_date": "2026-05-20T14:30:00Z",
        "decision_notes": "Well-researched topic with low similarity. Approved for proposal stage.",
        "similarity_score": 0.38,
        "risk_level": "low",
        "category": "epidemiology",
        "feedback_count": 2,
        "reviewer_name": "Dr. Smith"
      },
      ...
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
  ```

#### 3. Fetch Decision Detail with Feedback History
- **Endpoint:** `GET /api/decisions/:decision_id`
- **Purpose:** Retrieve full details for a selected decision, including feedback thread and historical similarity snapshot
- **Response Shape:**
  ```json
  {
    "decision_id": "dec-001",
    "topic_id": "topic-123",
    "topic_title": "Epidemiological Trends in COVID-19",
    "student_id": "stud-456",
    "student_name": "Alice Johnson",
    "student_email": "alice@university.edu",
    "supervisor_name": "Dr. Brown",
    "outcome": "approved",
    "decision_date": "2026-05-20T14:30:00Z",
    "decision_notes": "Well-researched topic with low similarity. Approved for proposal stage.",
    "similarity_snapshot": {
      "similarity_score": 0.38,
      "risk_level": "low",
      "jaccard_score": 0.35,
      "tfidf_score": 0.40,
      "sbert_score": 0.38,
      "top_matches": [
        {
          "match_id": "match-1",
          "matched_topic_title": "COVID-19 Pandemic Analysis",
          "similarity_percentage": 0.38,
          "source": "historical_topics"
        }
      ]
    },
    "feedback_history": [
      {
        "feedback_id": "fb-001",
        "feedback_date": "2026-05-20T14:30:00Z",
        "feedback_from": "Dr. Smith",
        "feedback_text": "Initial review completed. Requesting low-risk confirmation.",
        "feedback_type": "review_comment"
      },
      {
        "feedback_id": "fb-002",
        "feedback_date": "2026-05-20T15:00:00Z",
        "feedback_from": "Dr. Smith",
        "feedback_text": "Approved. Topic is unique and well-motivated.",
        "feedback_type": "final_decision"
      }
    ],
    "activity_timeline": [
      {
        "timestamp": "2026-05-15T10:00:00Z",
        "action": "submission_received",
        "actor": "student",
        "description": "Student submitted topic for review."
      },
      {
        "timestamp": "2026-05-20T14:30:00Z",
        "action": "decision_made",
        "actor": "lecturer",
        "description": "Lecturer approved topic."
      }
    ]
  }
  ```

### Data Requirements
- **Decision records table** in backend database with fields: decision_id, topic_id, student_id, outcome, decision_date, decision_notes, risk_level, similarity_score (or link to historical snapshot)
- **Feedback history** associated with each decision (many-to-one relationship)
- **Activity timeline** events linked to decisions
- **Historical similarity snapshots** should be preserved at the time of decision (not updated retroactively)

### Pagination & Filtering Logic
- Implement server-side filtering and pagination to handle large decision sets
- Support filters: outcome, risk_level, category, date range
- Support text search on topic_title and student_name
- Return total count and page metadata for UI pagination

---

## Visual Matching Notes

### Decisions Overview List
- **Layout:** Compact table or card-list with clear column/field separation
- **Status Badges:** Use distinct colors: green (Approved), red (Rejected), amber (Requested Changes)
- **Risk Chips:** Display risk level with icons and colors: green (Low), amber (Medium), red (High)
- **Rows:** Each row shows topic title, student name, outcome badge, date, risk chip, and expand icon (right-aligned)
- **Spacing:** Compact but readable; use dividers between rows if card-style
- **Header Row:** Column labels in a lighter background or bold text (Topic, Student, Outcome, Date, Risk, Actions)
- **Pagination:** Controls at bottom right with page info and navigation arrows
- **Export Button:** Top-right corner (disable if no records); label "Export Decisions" (v2.0 optional)

### Decision Detail Expansion
- **Layout:** Two-column design (left ≈60%, right ≈40%)
- **Left Column (Decision Notes & Timeline):**
  - Decision summary header: topic title, student name, outcome badge, decision date
  - Decision notes section with free-form text
  - Activity timeline showing decision history (submitted, reviewed, decided, feedback sent)
  - Feedback thread with individual messages/comments
- **Right Column (Similarity Snapshot):**
  - "Similarity Analysis (at time of decision)" header with historical callout
  - Score breakdown cards for Jaccard, TF-IDF, SBERT (same style as in Pending Review detail pages)
  - Top matched topics list (if applicable)
  - "View Full Report" CTA (links to a separate report view if available)
- **Colors:** Approved decisions use green accent; rejected use red; requested changes use amber
- **Spacing:** Clear visual separation between sections; use subtle dividers or background tints

### Empty Decisions State
- **Layout:** Large centered placeholder area (full viewport height or list container height)
- **Icon:** Large decorative icon (e.g., clipboard, checkmark, or history symbol)
- **Message:** "No decisions recorded yet" (primary message) + supporting text ("You haven't made any decisions in the current session. View pending reviews or check topic submissions.")
- **CTAs:** Two buttons: "View Pending Reviews" (primary) and "Check Similarity Results" (secondary), or single "Get Started" button
- **Styling:** Dashed border around placeholder area, muted text color, light background tint
- **Spacing:** Centered vertically and horizontally; adequate padding to feel balanced

### Shared Visual Elements
- **Reuse from Pending Review pages:** Status badge styling, risk badge styling, similarity score cards, feedback panel layout
- **Reuse from Student pages:** SearchInput styling, FilterDropdown styling, PaginationControls styling
- **Consistent Brand Colors:** Green (success/approval), red (rejection), amber (caution/changes), and neutral grays for status/background

---

## Decision History Behavior Notes

### Decision Lifecycle in the UI
1. **Decision Created:** When a lecturer approves/rejects/requests changes on a submission, a new decision record is created with a timestamp, outcome, and optional notes
2. **Feedback Associated:** Any feedback message or revision request is linked to the decision record and appears in the feedback history
3. **Similarity Snapshot Frozen:** The similarity analysis data (scores, matches) are captured at decision time and stored as a read-only snapshot; they do not update if the underlying topic or database changes
4. **Timeline Recorded:** Each significant event (submission received, decision made, feedback sent) is logged with timestamp and actor
5. **Accessible in History:** The decision record remains accessible in the Lecturer My Decisions page indefinitely (or until archived/purged per retention policy)

### Filtering & Search Behavior
- **Outcome Filter:** Allows lecturer to isolate decisions by type (e.g., "Show all Approved decisions this week")
- **Risk Filter:** Highlights decisions made on high-risk submissions for audit/review purposes
- **Category Filter:** Useful for department-level filtering or cross-checking decisions by field
- **Date Range:** Supports period-based reporting (e.g., "decisions made in May")
- **Text Search:** Searches both topic title and student name for quick lookup

### Pagination Behavior
- Default limit: 20 decisions per page (or as configured)
- User can change limit via dropdown (10, 20, 50, 100 options, v2.0 optional)
- "Previous" and "Next" buttons navigate between pages
- Current page indicator shows "Page X of Y"
- Clicking a decision row expands details inline (does not navigate away from list)

### Data Persistence & Privacy
- All decision records are **permanent audit records** (cannot be deleted by lecturers; only admins/system can purge)
- Decision notes are **editable** (v2.0 optional: add "Edit Notes" capability after initial approval)
- Feedback thread is **read-only** from the decision history view (replies may be v2.0 optional)

---

## Acceptance Checklist

### Functional Requirements
- [ ] **Decisions Overview List State**
  - [ ] Fetch and display paginated list of lecturer's decisions
  - [ ] Display decision records with columns: Topic Title, Student Name, Outcome (badge), Decision Date, Risk Level (badge)
  - [ ] Support filtering by outcome (Approved, Rejected, Requested Changes)
  - [ ] Support filtering by risk level (Low, Medium, High)
  - [ ] Support filtering by category (if applicable)
  - [ ] Support filtering by date range (optional for v1.0; implement if time permits)
  - [ ] Support text search by topic title or student name
  - [ ] Implement pagination with prev/next navigation and page indicators
  - [ ] Handle empty state gracefully (show message, disable export, provide CTAs)

- [ ] **Decision Detail Expansion State**
  - [ ] Expand a decision row to show detailed information inline or in a side panel
  - [ ] Display decision outcome, decision date, and decision notes in left column
  - [ ] Display activity timeline showing submission → review → decision events
  - [ ] Display feedback thread (comments from reviewer/lecturer)
  - [ ] Display historical similarity snapshot (read-only) in right column
  - [ ] Show Jaccard, TF-IDF, SBERT score cards in snapshot panel
  - [ ] Display top matched topics from the historical snapshot
  - [ ] Include "View Full Report" or "View Similarity Report" CTA (link to full similarity report page, if exists)
  - [ ] Collapse detail panel by clicking back/close button or navigating away
  - [ ] Preserve scroll position or restore to top of list after collapse (v2.0 optional)

- [ ] **Empty Decisions State**
  - [ ] Display empty state when decision_records array is empty
  - [ ] Show friendly icon, message, and supporting text
  - [ ] Provide CTA to "View Pending Reviews" (links to `/lecturer/pending-reviews` or similar)
  - [ ] Provide secondary CTA to "Check Similarity Results" or "Get Started"
  - [ ] Disable export button or hide it in empty state

- [ ] **General UI/UX**
  - [ ] All text and labels match Figma designs
  - [ ] Status/Risk badges use correct colors and icons (green, red, amber)
  - [ ] Responsive layout on desktop and tablet (mobile v2.0)
  - [ ] Reusable components are properly imported and styled
  - [ ] Loading state displayed during API fetch (skeleton or spinner)
  - [ ] Error state handled (e.g., "Failed to load decisions. Please try again.")
  - [ ] No UI crashes or console errors during interaction

### Backend/API Integration
- [ ] `GET /api/lecturers/me` endpoint implemented (returns lecturer profile)
- [ ] `GET /api/lecturers/me/decisions` endpoint implemented with query parameters
  - [ ] Supports `page` and `limit` query parameters
  - [ ] Supports `filterOutcome`, `filterRisk`, `filterCategory`, `filterDateFrom`, `filterDateTo`, `search` query parameters
  - [ ] Returns properly formatted response with data array and pagination metadata
- [ ] `GET /api/decisions/:decision_id` endpoint implemented (returns full decision detail)
  - [ ] Includes decision notes, similarity snapshot, feedback history, and activity timeline
  - [ ] Returns historical similarity data (not live updates)
- [ ] All API responses include appropriate HTTP status codes and error messages

### Component Integration
- [ ] `LecturerDashboardLayout` wraps the page
- [ ] `PageHeader` displays page title and optional breadcrumb
- [ ] `DecisionTable` or `DecisionCard` list displays decision records
- [ ] `SearchInput` and `FilterDropdown` allow filtering/searching
- [ ] `DecisionDetailsPanel` displays expanded decision details
- [ ] `LecturerFeedbackPanel` displays feedback thread
- [ ] `SimilarityResultPanel` displays historical snapshot
- [ ] `ActivityTimeline` displays decision timeline
- [ ] `StatusBadge` and `RiskBadge` display outcome and risk with correct styling
- [ ] `EmptyStatePanel` displays when no decisions exist
- [ ] `PaginationControls` enable page navigation

### Accessibility & Usability
- [ ] All interactive elements are keyboard-accessible (Tab, Enter, Escape)
- [ ] Color alone is not used to convey status; badges include icons and text labels
- [ ] Table/list has proper heading hierarchy (h1 for page title, h2+ for sections)
- [ ] ARIA labels or alt text provided for icons and badges
- [ ] Loading states are announced to screen readers
- [ ] Error messages are clear and actionable
- [ ] Links open in the same tab (no target="_blank" unless explicitly designed)

### Testing & Validation
- [ ] Unit tests written for filtering/search logic
- [ ] Integration tests verify API calls and response handling
- [ ] Manual testing confirms all states render correctly
- [ ] Manual testing confirms filtering and pagination work as expected
- [ ] Manual testing confirms error states are handled gracefully
- [ ] Cross-browser testing on Chrome, Firefox, Safari (if applicable)
- [ ] Performance verified (page loads within acceptable time, no lag during expand/collapse)

### Documentation & Handoff
- [ ] Component prop documentation updated (if using Storybook or similar)
- [ ] Page route documented in frontend routing guide
- [ ] Backend API contract documented (OpenAPI/Swagger or markdown)
- [ ] State management approach documented (if using Redux, Zustand, Context, etc.)
- [ ] Known limitations or deferred features noted (e.g., edit notes, export to CSV)

---

## Deferred / v2.0 Features

- **Export Decisions:** Download decisions list as CSV or PDF (placeholder button in header)
- **Edit Decision Notes:** Allow lecturer to update decision notes after initial decision (with audit trail)
- **Bulk Actions:** Select multiple decisions for batch operations (e.g., tag, export, archive)
- **Advanced Reporting:** Generate charts/summaries of decision outcomes, approval rates, average review time
- **Date Range Filter:** Initial implementation supports filtering but UI controls may be added post-v1.0
- **Reply to Feedback:** Allow lecturer to respond to student feedback or additional comments from other reviewers
- **Mobile Responsive:** Full mobile optimization deferred to v2.0; v1.0 targets desktop and tablet

---

## Assumptions

1. **Single Lecturer Scope:** Each lecturer sees only their own decisions; no cross-lecturer visibility in v1.0
2. **Current Session Only:** "Current session" refers to the active academic term or defined review window (backend determines scope)
3. **No Decision Editing (v1.0):** Decision outcomes and main notes are immutable; only metadata (like tags or custom notes) may be editable in v2.0
4. **Historical Snapshots:** Similarity data shown in decision details reflects the analysis performed at decision time; live re-analysis is not performed
5. **Pagination Server-Side:** Large decision sets are handled by backend pagination; frontend does not load all records at once
6. **No Real-Time Updates (v1.0):** Page does not auto-refresh when new decisions are made; user must manually refresh to see updates
7. **Simple Feedback Display:** Feedback thread is a flat list (no nested replies in v1.0); threaded conversations are v2.0 optional
8. **No Archival (v1.0):** All decisions remain visible indefinitely (or per system retention policy); manual archival is v2.0 optional

---

## Summary

The **Lecturer My Decisions** page is a core v1.0 feature that provides lecturers with an auditable record of their review decisions. It combines three states (Overview List, Detail Expansion, Empty State) into a cohesive workflow supporting filtering, searching, pagination, and historical review. The page reuses many components from adjacent screens (Pending Review, Dashboard) and depends on backend endpoints for decision records, feedback history, and similarity snapshots. Initial implementation focuses on read-only decision viewing and audit trails; advanced features like bulk export, note editing, and reporting are deferred to v2.0.
