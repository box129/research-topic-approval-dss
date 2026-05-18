# 06 — Reusable Component Inventory

> **Source:** All screen breakdown files, `Component-Library.md`, `Design-System-Foundation.md`
> **Framework:** React 18 + Vite + Tailwind CSS
> **Purpose:** Treat screen designs as component compositions, not isolated pages.

---

## Design System Tokens (All Components Use These)

```css
/* Colors */
--color-primary: #10B981;           /* Emerald 500 — primary green */
--color-primary-dark: #059669;      /* Emerald 600 — hover */
--color-primary-light: #D1FAE5;     /* Emerald 100 — subtle bg */
--color-warning: #F59E0B;           /* Amber 500 */
--color-warning-light: #FEF3C7;     /* Amber 100 */
--color-error: #EF4444;             /* Red 500 */
--color-error-light: #FEE2E2;       /* Red 100 */

/* Risk badge colors */
--risk-low-bg: #D1FAE5;   --risk-low-text: #065F46;
--risk-med-bg: #FEF3C7;   --risk-med-text: #92400E;
--risk-high-bg: #FEE2E2;  --risk-high-text: #991B1B;

/* Font */
font-family: Inter (sans), DM Serif Display (serif — headings only)
```

---

## Layout Components

---

### AppLayout
**Purpose:** Root authenticated layout wrapper — renders sidebar/topbar + page content area.

**Props:**
- `role: "lecturer" | "student" | "admin"`
- `children: ReactNode`

**Behaviour:**
- Renders role-specific sidebar navigation
- Renders topbar with logo + avatar dropdown
- Wraps content in max-width 1400px centered container with 32px padding
- 64px fixed topbar, flexible content area

**Used by:** Every authenticated screen (L1–L7, St1–St5, A1–A6)

---

### Sidebar
**Purpose:** Role-specific vertical navigation list.

**Props:**
- `role: "lecturer" | "student" | "admin"`
- `currentRoute: string`

**Behaviour:**
- Renders the correct nav items for the given role (see `05-ROUTES-AND-NAVIGATION-MAP.md`)
- Highlights the active route item in primary green
- v2.0 items render with a "Soon" pill and link to placeholder route
- Collapses to icon-only on tablet

**Used by:** AppLayout (all authenticated screens)

---

### Topbar
**Purpose:** Fixed top navigation bar with logo and avatar dropdown.

**Props:**
- `userName: string`
- `userRole: string`
- `userInitials: string`

**Behaviour:**
- Left: logo mark + system name
- Right: avatar circle with initials + dropdown on click
- Dropdown items: Account Details, Change Password, Notification Preferences, Sign Out

**Used by:** AppLayout (all authenticated screens)

---

### PageHeader
**Purpose:** Consistent page title + optional subtitle for every screen.

**Props:**
- `title: string` — DM Serif Display, 28px
- `subtitle?: string` — 14px, secondary text colour

**Used by:** L1, L2, L4, L5, L6, L7, St1, St2, St4, St5, A1, A2, A3, A4, A5, A6

---

## Data Display Components

---

### StatCard
**Purpose:** Single metric display — count or value with a label.

**Props:**
- `label: string`
- `value: string | number`
- `subValue?: string` — e.g. percentage
- `variant?: "default" | "warning" | "error"`

**Used by:** L1 (Pending Reviews stat, Approved, Rejected), A1 (health cards, usage stats), L7 (My Overview stats), St1 (in summary context)

---

### RiskBadge
**Purpose:** Colour-coded risk level indicator. ALWAYS includes text — colour is never the only signal.

**Props:**
- `level: "LOW" | "MEDIUM" | "HIGH"`
- `size?: "sm" | "md"` — default md

**Variants:**
- LOW: `#D1FAE5` bg, `#065F46` text, "🟢 LOW"
- MEDIUM: `#FEF3C7` bg, `#92400E` text, "🟡 MEDIUM"
- HIGH: `#FEE2E2` bg, `#991B1B` text, "🔴 HIGH"

**Used by:** L2 (table rows), L3 (result header), L4 (table rows), L6 (supervisee panels), St1 (active topic card), St2 (Step 2 result, Step 3 summary), St3 (row panels), St4 (results), A5 (audit log rows)

---

### StatusBadge
**Purpose:** Submission status indicator — for student-facing status displays.

**Props:**
- `status: "Pending" | "Approved" | "Rejected" | "AwaitingRevision" | "NotSubmitted"`

**Variants:**
- Pending: blue `#DBEAFE` bg, `#1E40AF` text
- Approved: green `#D1FAE5` bg, `#065F46` text
- Rejected: red `#FEE2E2` bg, `#991B1B` text
- Awaiting Revision: amber `#FEF3C7` bg, `#92400E` text
- Not Submitted: `var(--bg-secondary)` bg, secondary text

**Used by:** St1, St3, L6

---

### DataTable
**Purpose:** Reusable sortable, filterable table for lists of records.

**Props:**
- `columns: Column[]`
- `rows: Row[]`
- `onRowClick?: (row) => void`
- `selectable?: boolean` — shows checkboxes
- `onSelectionChange?: (selectedIds) => void`
- `emptyState?: ReactNode`
- `loading?: boolean`

**Behaviour:**
- Hover: `var(--bg-secondary)` row background
- Cursor pointer if `onRowClick` provided
- Bulk action bar slides up from bottom when rows selected
- Pagination built-in (20 rows per page by default)

**Used by:** L2 (pending reviews), L4 (decisions), A2 (users table), A3 (topics table), A5 (audit log)

---

### ExpandableRow / InlineDetailPanel
**Purpose:** Inline expansion pattern used throughout — clicking a row reveals a detail panel below it.

**Props:**
- `isOpen: boolean`
- `onToggle: () => void`
- `children: ReactNode` — the panel content

**Behaviour:**
- Smooth height transition (200ms ease-out) on open/close
- Only one open at a time (parent manages state)
- Left accent border colour matches status/context

**Used by:** L4 (decision history), L6 (supervisee rows), St3 (submission rows), A5 (audit log rows)

---

## Topic Input Components

---

### TopicInputForm
**Purpose:** The standard topic textarea used across all check/submit screens.

**Props:**
- `value: string`
- `onChange: (value: string) => void`
- `onSubmit: () => void`
- `submitLabel: string` — e.g. "Check Similarity", "Check My Topic", "Next →"
- `categoryValue?: string`
- `onCategoryChange?: (cat: string) => void`
- `showCategory?: boolean`
- `disabled?: boolean`
- `loading?: boolean`
- `loadingLabel?: string` — e.g. "Analyzing...", "Checking..."

**Behaviour:**
- Live word + character counter below textarea
- Progress bar filling left-to-right as word count approaches 7–24
- Valid range: green, out of range: red
- Submit button disabled when out of range (L5, St4) or when required fields empty (St2)
- Validation messages shown on submit attempt

**Validation messages (standard across all uses):**
- "❌ Too short. Minimum 7 words required. (currently X words)"
- "❌ Too long. Maximum 24 words. (currently X words)"
- "❌ Add more detail. Minimum 50 characters."
- "❌ Shorten topic. Maximum 180 characters."
- "❌ Topic cannot be empty."

**Used by:** L5, St2 (Step 1), St4

---

## Similarity Results Components

---

### SimilarityResultPanel
**Purpose:** The full results display — composes AlgorithmScoreRow + TierMatchSection × 3. Used after a similarity check completes.

**Props:**
- `result: SimilarityResult`
- `showAlgorithmScores?: boolean` — false for student-facing (D26)
- `showTier2?: boolean` — false for student-facing
- `showTier3?: boolean` — false for student-facing
- `showDecisionPanel?: boolean` — true only for L3
- `onDecision?: (type, data) => void`
- `degraded?: boolean` — SBERT unavailable

**Used by:** L3, L5, St2 (Step 2), St4

---

### RiskBanner
**Purpose:** Overall risk result banner with plain-language recommendation.

**Props:**
- `level: "LOW" | "MEDIUM" | "HIGH" | "DEGRADED"`
- `score: number` — max similarity percentage
- `audience: "lecturer" | "student"` — controls language
- `recommendation?: string`

**Language variants:**
- Lecturer: "🔴 HIGH RISK (88% max similarity)"
- Student: "🔴 High similarity detected (88% similarity)"

**Used by:** L3, L5, St2 Step 2, St4

---

### AlgorithmScoreRow
**Purpose:** Displays the three algorithm scores side by side with tooltips.

**Props:**
- `jaccard: number | null`
- `tfidf: number | null`
- `sbert: number | null` — null when SBERT unavailable

**Behaviour:**
- Score colour thresholds are pending confirmation because threshold values are a known documentation/implementation conflict. Do not hard-code 30/60 or any replacement values without explicit approval.
- SBERT null: shows "N/A" at 50% opacity
- Tooltip on each algorithm name (plain English explanations)

**Used by:** L3, L5 (lecturer only — NOT student-facing per D26)

---

### TierMatchSection
**Purpose:** Single collapsible tier section (Tier 1, 2, or 3).

**Props:**
- `tier: 1 | 2 | 3`
- `matches: TopicMatch[]`
- `defaultOpen?: boolean` — true for Tier 1 on L3, false for Tier 2/3
- `concurrentAlert?: ConcurrentReview` — Tier 3 only

**Behaviour:**
- Header row: chevron + tier label + match count
- Tier 1 + 2: renders TopicCard grid
- Tier 3: renders alert-style content (not cards)
- Smooth expand/collapse with chevron rotation

**Used by:** L3, L5, St2 Step 2, St4

---

### TopicCard
**Purpose:** A single matched topic card in the tier grid.

**Props:**
- `title: string`
- `year: number`
- `supervisor: string`
- `similarityScore: number`
- `matchedKeywords: string[]`

**Layout:** Card container, similarity badge top-right, title (2-line max), year · supervisor, keyword chips below

**Grid:** 3-col desktop, 2-col laptop, 1-col tablet. Max 5 cards per tier.

**Used by:** TierMatchSection → L3, L5, St2, St4

---

### DecisionPanel
**Purpose:** Sticky bottom panel with Approve / Request Changes / Reject buttons. Lecturer only.

**Props:**
- `topicTitle: string` — shown truncated on left for context
- `onApprove: () => void`
- `onRequestChanges: () => void`
- `onReject: () => void`

**Behaviour:** Fixed to viewport bottom at all times on L3. Above footer, below page content.

**Used by:** L3 only

---

## Modal Components

---

### Modal
**Purpose:** Generic modal overlay wrapper.

**Props:**
- `isOpen: boolean`
- `onClose: () => void`
- `title: string`
- `width?: number` — default 440px
- `children: ReactNode`

**Used by:** Approve, RequestChanges, Reject decision modals; Add User (A2); Confirm Import (A3); Auth error states

---

### ApproveModal
**Props:** `topicTitle, studentName, onConfirm, onCancel`
**Used by:** L3

### RequestChangesModal
**Props:** `topicTitle, onConfirm(guidance), onCancel`
**Used by:** L3

### RejectModal
**Props:** `topicTitle, onConfirm(reason, notes), onCancel`
**Used by:** L3

---

## Admin-Specific Components

---

### ImportWizard
**Purpose:** 4-step import modal for A3.

**Props:**
- `onComplete: (result) => void`
- `onClose: () => void`

**Steps:** Upload → Column Mapping → Validation Preview → Confirm Import

**Used by:** A3 only

---

### DuplicateResolutionPanel
**Purpose:** Below-table panel showing flagged duplicate pairs side by side.

**Props:**
- `pairs: DuplicatePair[]`
- `onResolve: (pairId, action) => void`
- `onClose: () => void`

**Used by:** A3 only

---

### ServiceHealthCard
**Purpose:** Individual service status card for A1.

**Props:**
- `service: "API" | "Database" | "SBERT"`
- `status: "healthy" | "degraded" | "down"`
- `lastChecked: string`

**Used by:** A1 only

---

### AuditLogTable
**Purpose:** Specialised table for A5 with expandable rows and variable content depth.

**Props:**
- `events: AuditEvent[]`
- `filters: AuditFilters`
- `onFilterChange: (filters) => void`

**Used by:** A5 only

---

## State Components (Shared)

---

### EmptyState
**Props:**
- `icon: ReactNode`
- `title: string`
- `body?: string`
- `cta?: { label: string, onClick: () => void }[]`

**Used by:** L2, L6, L7 (placeholder), St1, St3, St5 (placeholder), A1, A2, A3, A5, A6 (placeholder)

---

### LoadingState
**Purpose:** Skeleton loading animation while data loads.

**Props:**
- `type: "table" | "cards" | "panel" | "stats"`
- `count?: number`

**Used by:** L2, L3, L4, A2, A3, A5 and any screen awaiting API response

---

### ErrorState
**Props:**
- `message: string`
- `requestId?: string`
- `onRetry?: () => void`

**Used by:** Any screen on API failure

---

### SBERTDegradedBanner
**Purpose:** Yellow warning shown when SBERT service is unavailable.

**Content:** "⚠️ Semantic analysis is unavailable. Results may not detect topics with similar meaning but different wording."

**Used by:** L3, L5, St2 Step 2, St4, A1 (as alert banner)

---

### AlertBanner
**Props:**
- `variant: "warning" | "error" | "info" | "success"`
- `message: string`
- `action?: { label: string, href: string }`
- `dismissible?: boolean`

**Used by:** A1 (system health alerts), A4 (unsaved changes warning), St3 (email deep link banner), L2 (concurrent review alert)

---

## Component Usage Matrix (Summary)

| Component | L1 | L2 | L3 | L4 | L5 | L6 | St1 | St2 | St3 | St4 | A1 | A2 | A3 | A4 | A5 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AppLayout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| StatCard | ✅ | | | | | | | | | | ✅ | | | | |
| RiskBadge | | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | | | | | |
| DataTable | | ✅ | | ✅ | | | | | | | | ✅ | ✅ | | ✅ |
| TopicInputForm | | | | | ✅ | | | ✅ | | ✅ | | | | | |
| SimilarityResultPanel | | | ✅ | | ✅ | | | ✅ | | ✅ | | | | | |
| DecisionPanel | | | ✅ | | | | | | | | | | | | |
| Modal | | | ✅ | | | | | | | | | ✅ | ✅ | | |
| EmptyState | | ✅ | | | ✅ | ✅ | ✅ | | ✅ | ✅ | | ✅ | ✅ | | |
| AlertBanner | ✅ | | ✅ | | ✅ | | | | ✅ | ✅ | ✅ | | | ✅ | |
| InlineDetailPanel | | | | ✅ | | ✅ | | | ✅ | | | | | | ✅ |

---

*Source: All screen breakdown files, `Component-Library.md`, `Design-System-Foundation.md`*
