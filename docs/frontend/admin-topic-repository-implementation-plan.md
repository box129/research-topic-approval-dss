# Admin Topic Repository Implementation Plan

## 1. Screen/State Summary
The Admin Topic Repository provides admins with a searchable, filterable, and expandable list of all historical/approved topics. It supports topic detail expansion, repository filtering, and an empty/import prompt state. All four states are v1.0 priorities.

### States
- **Repository list** (default): Table of topics with search/filter, import/add affordances.
- **Topic detail expansion**: Expanded view for a selected topic, showing metadata, full text, similarity snapshot, and related topics.
- **Filtered repository view**: Repository list filtered by search, category, year, or department.
- **Empty / import prompt**: Shown when no topics exist; provides import/add controls and guidance.

## 2. v1.0 Implementation Priority
All four states are required for v1.0. Import/add affordances should exist, but advanced import validation, mapping UI, and bulk processing are deferred to v2.0.

## 3. Component Breakdown
- AdminDashboardLayout
- PageHeader
- TopicRepositoryTable
- TopicRepositoryCard
- TopicDetailsPanel
- SearchInput
- FilterDropdown
- ActiveFilterBanner
- FacetPanel
- ImportTopicsButton
- AddTopicButton
- EditTopicForm
- StatusBadge
- RiskBadge
- EmptyStatePanel
- PaginationControls
- PrimaryButton
- SecondaryButton
- ConfirmActionModal

## 4. Route/State Mapping
- `/admin/repository` — Repository list (default)
- `/admin/repository?filter=...` — Filtered repository view
- `/admin/repository/:topicId` — Topic detail expansion
- `/admin/repository/empty` — Empty/import prompt (conditional on data)

## 5. Backend/API Dependency Notes
- List of historical/approved topics
- topic id, title, full text, supervisor, category, department, academic session/year, approved date, tags, source, status, risk label
- similarity snapshot, related topics
- search/filter parameters, pagination metadata
- add topic endpoint
- update topic endpoint
- delete/remove topic endpoint (if available)
- import topics endpoint (if available)

## 6. Visual Matching Notes
- Table/list layout with compact rows, status/risk badges, and filter controls
- Detail panel/expansion for full topic view and similarity snapshot
- Import/add controls in header or empty state
- Use brand/admin dashboard styling for consistency

## 7. Repository Management Behavior Notes
- Support search, filter, and pagination for large topic sets
- Allow topic detail expansion inline or as a panel
- Provide add/import affordances in both populated and empty states
- Confirm destructive actions (delete/remove) with modal
- Use mock/simple import for v1.0 if backend is incomplete

## 8. Deferred/v2.0 Notes
- Advanced import validation and mapping UI
- Bulk import processing and error handling
- Export/download repository data
- Deep analytics and reporting
- Bulk topic editing

## 9. Acceptance Checklist
- [ ] Repository list displays topics with search/filter/pagination
- [ ] Topic detail expansion shows all required metadata and similarity snapshot
- [ ] Filtered view updates list and facets correctly
- [ ] Empty/import prompt appears when no topics exist
- [ ] Add/import affordances are present and functional (mocked if needed)
- [ ] All destructive actions require confirmation
- [ ] Visuals match Figma audit and admin dashboard style
- [ ] All backend dependencies are handled or mocked for demo
