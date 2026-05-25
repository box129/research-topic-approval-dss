# Student Research Explorer Implementation Plan

## 1. Student Research Explorer screen/state summary
The Student Research Explorer page is a discovery and browsing surface that helps students find approved research topics, explore trends and underexplored areas, and inspect topic details before checking or submitting their own topic.

Core v1.0 states (all required for the exploration workflow):
- **Overview discovery** — default discovery surface with trending keywords, distribution/insight cards, and an approved topics list.
- **Filtered category view** — results and insight cards filtered by a chosen category (e.g., Epidemiology).
- **Topic detail expansion** — inline expansion or side panel showing detailed information for a selected approved topic.
- **Empty explorer state** — placeholder UI when no approved topics match the current query/filters.

Role: Student
Purpose: Help students browse existing approved topics, inspect details, and use insights to inform topic creation.

## 2. v1.0 implementation priority
All four states are v1.0 because they form the essential exploration workflow: discover, filter, inspect, and handle empty results.

Implementation priority (suggested):
1. Overview discovery (default UI, search, filters, and results list)
2. Filtered category view (filter controls and filtered results)
3. Topic detail expansion (expandable card or inline details)
4. Empty explorer state (friendly no-results messaging and CTA)

## 3. Component breakdown
Suggested reusable components:
- `StudentDashboardLayout`
- `PageHeader`
- `ResearchExplorerPanel` (page shell / insights + list)
- `SearchInput`
- `FilterDropdown`
- `TopicResultList`
- `TopicCard`
- `TopicDetailsPanel` (inline expansion / side panel)
- `EmptyStatePanel`
- `StatusBadge`
- `RiskBadge` (if topics surface risk metadata)
- `InfoCallout`
- `PrimaryButton`
- `SecondaryButton`
- `PaginationControls`

Component responsibilities:
- `ResearchExplorerPanel` composes the insights cards and results list and coordinates filtering and search.
- `TopicResultList` renders `TopicCard` items and handles pagination/virtualization.
- `TopicCard` shows summary metadata (title, category, year, supervisor, status badge) and a control to expand details.
- `TopicDetailsPanel` displays full topic metadata and related actions (e.g., "Check similarity", "Start submission").

## 4. Route/state mapping
- Route: `/student/research-explorer`
- Default route state: Overview discovery (search + filters inactive)
- Query and filter values control the search/filter state (e.g., `?q=keyword&category=Epidemiology&page=2`)
- Topic detail expansion is inline (expanded card or side panel) rather than a separate route, unless the codebase already uses route-driven detail pages
- Empty explorer state is shown when the API returns zero results for the current query/filters
- No separate routes are required for each state unless existing patterns in the repo prefer route-per-detail (opt-in)

## 5. Backend/API dependency notes
Required backend data and API behaviour:
- Current student profile (optional; for personalization/permissions)
- Endpoint: `GET /api/topics` (or equivalent) returning approved historical topics with pagination
  - Request params: `q`, `category`, `year`, `supervisor`, `page`, `perPage`
  - Response: list of topics plus pagination metadata
- Topic fields: `id`, `title`, `summary`, `category`, `year`, `supervisor`, `department`, `status`, `createdAt`
- Aggregation/insights endpoints or computed fields for: trending keywords, topic distribution, underexplored areas (could be server-side or client-side computed)
- Optional: `GET /api/topics/:id` for richer topic details if not included in list results
- Pagination metadata: `total`, `page`, `perPage`, `totalPages`

API behaviour expectations:
- Filtered queries should be fast and support combined filters
- The list endpoint should include enough summary metadata to show `TopicCard` without requiring a second call per-item
- Topic details endpoint should provide expanded fields and related keywords/links when requested

## 6. Visual matching notes
- Use a clear page header and a two-column-ish layout: insight/discovery cards (top or side) and the main results list.
- Discovery cards (trending keywords, distribution charts) should be visually distinct and lightweight.
- `TopicCard` should prioritise title, category, year, supervisor, and a short summary; use `StatusBadge` for approved/archived markers.
- Use muted/dashed placeholders for the empty explorer state with a strong CTA to submit a topic.
- Keep filter controls compact and persistent at the top of the results list for easy refinement.

## 7. Acceptance checklist
- [ ] Route `/student/research-explorer` exists and renders the `ResearchExplorerPanel`.
- [ ] Overview discovery state renders insight cards and a searchable, paginated list of approved topics.
- [ ] Filter controls (category, year, supervisor) filter results and update the list accordingly.
- [ ] Filtered category view renders filtered insights and a reduced results list.
- [ ] Topic detail expansion displays inline details for a selected topic without navigating away.
- [ ] Empty explorer state displays a friendly placeholder with a CTA when zero results returned.
- [ ] `TopicCard` renders summary metadata consistently (title, category, year, supervisor, status badge).
- [ ] Backend dependencies documented and validated: list endpoint, optional detail endpoint, pagination metadata, and aggregation/insight data.
- [ ] UI uses reusable components listed in this plan and avoids creating one-off per-page components.

---

Notes / assumptions:
- All states are v1.0 and intended as a single-page experience controlled by query params and API responses.
- If the codebase prefers deep linking to topic details, convert `TopicDetailsPanel` to a route such as `/student/research-explorer/:id` later.
- Aggregation/insight data may be computed server-side or derived client-side from the list endpoint; prefer server-side endpoints for large datasets.
