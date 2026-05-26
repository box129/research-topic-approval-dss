# Figma Implementation Index - UNIOSUN Topic Similarity System

## 1. Purpose of This Index

This document serves as the master frontend planning guide for implementing the UNIOSUN Research Topic Similarity Detection System. It consolidates all screen groups, states, implementation plans, and strategic recommendations into a single reference. It is intended to:

- Provide a complete inventory of all Figma screen groups and states
- Guide implementation sequencing and prioritization
- Track v1.0 core, v1.0 placeholder, and v2.0 deferred features
- Define shared component architecture and reusability
- Establish design-to-code rules and QA criteria
- Map backend API dependencies
- Recommend branching and PR strategy

**This is a documentation-only guide. Do not implement UI code yet.**

---

## 2. Full Screen Group Inventory

### Screen Groups by Role

**Shared (all roles)**
- Authentication (AUTH-01, AUTH-POP-01..07)

**Student Workflow**
- Student Dashboard (STUD-01)
- Student Submit Topic (STUD-02)
- Student My Submissions (STUD-03)
- Student Check My Topic (STUD-04)
- Student Research Explorer (STUD-05)

**Lecturer Workflow**
- Lecturer Dashboard (LECT-01)
- Lecturer Pending Review (LECT-02)
- Lecturer My Decisions (LECT-03)
- Lecturer Check Similarity (LECT-04)
- Lecturer Supervisees (LECT-05)
- Lecturer Research Trends (LECT-06)

**Admin Workflow**
- Admin Dashboard (ADMIN-01)
- Admin User Management (ADMIN-02)
- Admin Topic Repository (ADMIN-03)
- Admin System Settings (ADMIN-04)
- Admin Audit Log (ADMIN-05)
- Admin Reports (ADMIN-06)

**Total: 22 screen groups with 97 distinct states**

---

## 3. v1.0 Core Screens

These are essential for initial launch and represent primary user workflows:

### Authentication
- AUTH-01: Default, Invalid credentials, Account locked (v1.0)
- AUTH-POP-01: Signing in / processing (v1.0)

### Student Core Workflow
- STUD-01: Awaiting revision, Pending review, Approved, No submission (v1.0)
- STUD-02: Empty topic entry, Similarity preview - ready to submit, Similarity warning, Confirm submission (v1.0)
- STUD-03: Awaiting revision, Approved, Pending review, No submissions, Notification opened (v1.0)
- STUD-04: Default check form, Low similarity result, High similarity warning, Medium similarity partial analysis (v1.0)
- STUD-05: Overview discovery, Filtered category view, Topic detail expansion, Empty explorer state (v1.0)

### Lecturer Core Workflow
- LECT-01: Overview summary, High-risk alerts & review queue (v1.0)
- LECT-02: Empty assigned queue, Department review list, Assigned queue (filtered), Submission detail — High risk analysis, Submission detail — Low risk analysis, Submission detail — Medium risk / partial analysis, Decision confirmation modal (v1.0)
- LECT-03: Decisions overview list, Decision detail expansion, Empty decisions state (v1.0)
- LECT-04: Default manual topic check form, Analysis in progress, Low similarity result, High similarity warning, Medium similarity partial analysis (v1.0)
- LECT-05: Overview list, Filtered pending view, Supervisee detail expansion, Empty supervisees state (v1.0)

### Admin Core Workflow
- ADMIN-01: System overview, Degraded health alert, Critical outage (v1.0)
- ADMIN-02: All users list, Filtered lecturer list, Add user modal (v1.0)
- ADMIN-03: Repository list, Topic detail expansion, Filtered repository view, Empty / import prompt (v1.0)
- ADMIN-04: Settings overview, Thresholds editor (v1.0), Sessions & services panel (v1.0 placeholder)
- ADMIN-05: Log list, Filtered / actor view (v1.0), Export / forensic detail (v1.0 placeholder)

**v1.0 Total: 71 states across 16 screen groups**

---

## 4. v1.0 Placeholder Screens

These screens should visually exist in v1.0 but may use mock/static/simple aggregated data. Real functionality is deferred to v2.0:

- LECT-06: Overview summary, Filtered focus view, No trend data (v1.0 placeholder)
- ADMIN-04-S3: Sessions & services panel (v1.0 placeholder)
- ADMIN-05-S3: Export / forensic detail (v1.0 placeholder)
- ADMIN-06: Reports overview, Session-filtered report, Export PDF report (configuration modal) (v1.0 placeholder)

**v1.0 Placeholder Total: 10 states across 4 screen groups**

---

## 5. v2.0 Deferred Features

These are recovery flows, advanced analytics, export functionality, and complex integrations. They are explicitly deferred:

### Authentication v2.0
- AUTH-POP-02..07: Forgot password, password reset, validation error, link expired flows

### Deferred Features by Category
- **Export/Reporting**: PDF/CSV export, scheduled reports, compliance reporting
- **Analytics**: Advanced trend analysis, keyword clustering, workload analytics, heatmaps
- **Advanced Filtering**: Complex multi-criteria filtering, cross-session comparisons, forensic analytics
- **Integration**: External service integrations, advanced import validation, bulk processing
- **Recovery**: Password reset flows, account recovery, session management

**v2.0 Total: 16 states across 3 screen groups + feature enhancements**

---

## 6. Recommended Implementation Order

### Phase 1: Foundation (Weeks 1-2)
**Deliverables:** Base UI component library, design tokens, shared layouts

Implement before any screen is built:
- Shared design tokens (colors, typography, spacing, shadows)
- Base component library:
  - Text inputs, buttons, selects, toggles, checkboxes, radio buttons
  - Cards, badges, pills, alerts, modals, tooltips
  - Tables, pagination controls, empty states, loading states
  - Layouts: SidebarLayout, DashboardLayout, ModalOverlay, PageContainer
  - Navigation: Sidebar nav, breadcrumbs, tabs, breadcrumb navigation
- Form handling utilities (validation, error display, state management)
- Routing infrastructure

**Phase 1 Implementation Plans:** (foundation only, not screen-specific)

---

### Phase 2: Authentication (Week 2-3)
**Deliverables:** Login flow, error states, processing states

Implement from `auth-flow-implementation-plan.md`:
- AUTH-01: Default login
- AUTH-01-S1: Invalid credentials
- AUTH-01-S2: Account locked
- AUTH-POP-01: Signing in / processing

**Key Components:** AuthSplitLayout, LoginForm, TextInput, PasswordInput, InlineErrorBanner, WarningBanner

---

### Phase 3: Student Core Workflow (Weeks 3-5)
**Deliverables:** Full student submission and review journey

Implement from existing student implementation plans:
1. **Student Dashboard** (STUD-01)
   - Awaiting revision, Pending review, Approved, No submission
   - From `student-dashboard-implementation-plan.md`
   
2. **Student Submit Topic** (STUD-02)
   - Empty topic entry, Similarity preview, Similarity warning, Confirm submission
   - From `student-submit-topic-implementation-plan.md`
   
3. **Student My Submissions** (STUD-03)
   - All state variations and notification handling
   - From `student-my-submissions-implementation-plan.md`
   
4. **Student Check My Topic** (STUD-04)
   - Default check form, Low/High/Medium similarity results
   - From `student-check-my-topic-implementation-plan.md`
   
5. **Student Research Explorer** (STUD-05)
   - Overview discovery, Filtered views, Topic expansion, Empty state
   - From `student-research-explorer-implementation-plan.md`

**Key Components:** StudentDashboardLayout, TopicSubmissionForm, SimilarityResultPanel, TopicCheckForm, ResearchExplorerPanel

---

### Phase 4: Lecturer Core Workflow (Weeks 5-7)
**Deliverables:** Full lecturer review and analytics journey

Implement from existing lecturer implementation plans:
1. **Lecturer Dashboard** (LECT-01)
   - Overview summary, High-risk alerts
   - From `lecturer-dashboard-implementation-plan.md`
   
2. **Lecturer Pending Review** (LECT-02)
   - All queue and detail states, decision modal
   - From `lecturer-pending-review-implementation-plan.md`
   
3. **Lecturer My Decisions** (LECT-03)
   - Decisions list, detail expansion, empty state
   - From `lecturer-my-decisions-implementation-plan.md`
   
4. **Lecturer Check Similarity** (LECT-04)
   - Default form, in-progress, result states
   - From `lecturer-check-similarity-implementation-plan.md`
   
5. **Lecturer Supervisees** (LECT-05)
   - Overview list, filtered views, detail expansion
   - From `lecturer-supervisees-implementation-plan.md`

**Key Components:** LecturerDashboardLayout, PendingReviewList, ReviewQueueTable, TopicCheckForm, SuperviseeTable

---

### Phase 5: Admin Core Workflow (Weeks 7-9)
**Deliverables:** Complete admin management and oversight

Implement from existing admin implementation plans:
1. **Admin Dashboard** (ADMIN-01)
   - System overview, degraded health, critical outage
   - From `admin-dashboard-implementation-plan.md`
   
2. **Admin User Management** (ADMIN-02)
   - User list, filtered views, add user modal
   - From `admin-user-management-implementation-plan.md`
   
3. **Admin Topic Repository** (ADMIN-03)
   - Repository list, topic detail, filtered views, empty state
   - From `admin-topic-repository-implementation-plan.md`
   
4. **Admin System Settings** (ADMIN-04)
   - Settings overview, thresholds editor, sessions & services (placeholder)
   - From `admin-system-settings-implementation-plan.md`
   
5. **Admin Audit Log** (ADMIN-05)
   - Log list, filtered views, export placeholder
   - From `admin-audit-log-implementation-plan.md`

**Key Components:** AdminDashboardLayout, UserTable, TopicRepositoryTable, SettingsSection, AuditLogTable

---

### Phase 6: Analytics & Reporting (Weeks 9-10)
**Deliverables:** Placeholder analytics dashboards (v1.0 placeholder with mock data)

Implement as v1.0 placeholders:
1. **Lecturer Research Trends** (LECT-06)
   - Overview summary, filtered focus view, no data state
   - From `lecturer-research-trends-implementation-plan.md`
   
2. **Admin Reports** (ADMIN-06)
   - Reports overview, session-filtered report, export modal
   - From `admin-reports-implementation-plan.md`

**Key Components:** ReportSummaryCard, ReportChart, TrendChart, HeatmapPanel, WorkloadPanel

---

## 7. Route Map

```
/login
  - GET /login → AUTH-01 (Default login)
  - Interactive login form with email/password

/dashboard (role-based redirect)
  - /student/dashboard → STUD-01 (various states)
  - /lecturer/dashboard → LECT-01 (various states)
  - /admin/dashboard → ADMIN-01 (various states)

Student Routes:
  /student/submit-topic → STUD-02 (various states)
  /student/my-submissions → STUD-03 (various states)
  /student/check-topic → STUD-04 (various states)
  /student/explore → STUD-05 (various states)

Lecturer Routes:
  /lecturer/pending-review → LECT-02 (various states)
  /lecturer/pending-review/:submissionId → LECT-02-S4/S5/S6 (detail states)
  /lecturer/my-decisions → LECT-03 (various states)
  /lecturer/check-similarity → LECT-04 (various states)
  /lecturer/supervisees → LECT-05 (various states)
  /lecturer/research-trends → LECT-06 (placeholder states)

Admin Routes:
  /admin/users → ADMIN-02 (various states)
  /admin/topic-repository → ADMIN-03 (various states)
  /admin/settings → ADMIN-04 (various states)
  /admin/audit-log → ADMIN-05 (various states)
  /admin/reports → ADMIN-06 (various states)
```

---

## 8. Shared Reusable Component Map

### Layout Components
- **AuthSplitLayout**: Two-column split for login (left hero, right form)
- **StudentDashboardLayout**: Student-facing dashboard with sidebar and main content
- **LecturerDashboardLayout**: Lecturer-facing dashboard with sidebar and main content
- **AdminDashboardLayout**: Admin-facing dashboard with sidebar and main content

### Form Components
- **TextInput**: Single-line text field with validation
- **TextAreaInput**: Multi-line text input
- **SelectInput**: Dropdown selector
- **PasswordInput**: Password field with visibility toggle
- **ToggleSwitch**: On/off toggle
- **NumberInput**: Numeric input with validation
- **DateRangeFilter**: Date range selector (preset/custom)
- **SearchInput**: Search field with clear action
- **FilterDropdown**: Multi-select filter dropdown

### Display Components
- **Card**: Base card container
- **DashboardStatusCard**: Status card with icon and metric
- **TopicSummaryCard**: Topic title and metadata card
- **SubmissionCard**: Submission entry card
- **TopicRepositoryCard**: Repository topic card
- **DecisionCard**: Decision history card
- **PendingReviewCard**: Review queue entry card

### Data Display Components
- **Table**: Base table with sorting/pagination
- **UserTable**: User management table
- **TopicRepositoryTable**: Repository table
- **ReviewQueueTable**: Pending review table
- **PendingReviewList**: Compact review list
- **SuperviseeTable**: Supervisee roster table
- **DecisionHistoryList**: Decision history list
- **AuditLogTable**: Audit event table

### Result/Analysis Components
- **SimilarityResultPanel**: Similarity analysis results display
- **SimilarityScoreBreakdown**: Algorithm score cards (Jaccard, TF-IDF, SBERT)
- **SimilarTopicCard**: Individual matching topic card
- **HighRiskAlertCard**: High-risk warning card
- **ReportSummaryCard**: Report metric card
- **ReportChart**: Generic chart wrapper
- **TrendChart**: Trend visualization
- **HeatmapPanel**: Discipline/heatmap visualization
- **WorkloadPanel**: Workload summary panel

### Navigation/Action Components
- **StatusBadge**: Status indicator badge (Pending, Approved, Rejected, etc.)
- **RiskBadge**: Risk level badge (Low, Medium, High)
- **ActivityFeed**: Activity timeline display
- **ActivityTimeline**: Detailed activity timeline
- **PrimaryButton**: Primary action button (green)
- **SecondaryButton**: Secondary action button
- **PrimaryButton**: CTA button with gold/orange accent
- **SecondaryLinkButton**: Link-style secondary button
- **ExportButton**: Export action button
- **DownloadButton**: Download action button

### Feedback/State Components
- **EmptyStatePanel**: Empty state placeholder
- **PlaceholderPanel**: Data loading placeholder
- **LoadingStatePanel**: Loading indicator state
- **InlineErrorBanner**: Form error banner
- **WarningBanner**: Warning alert banner
- **SystemAlertCard**: System alert card (for outages)
- **InfoCallout**: Information callout box
- **ConfirmActionModal**: Confirmation modal overlay

### Specialized Components
- **AuthBrandPanel**: Left hero panel for login
- **LoginForm**: Login form wrapper
- **FeatureBulletList**: Feature highlights list
- **AuthFooterNote**: Auth footer note
- **PageHeader**: Page title and metadata header
- **SegmentControl**: Multi-segment selector
- **PaginationControls**: Page navigation controls
- **ActiveFilterBanner**: Active filter display banner
- **FacetPanel**: Filter facets sidebar
- **KeywordChipGroup**: Keyword tag group
- **DataTable**: Generic data table
- **StatusTable**: Status-focused table
- **QueuePreview**: Queue preview card
- **QuickActionsPanel**: Quick action shortcuts
- **ReviewStatusPanel**: Review status display
- **ApprovalPanel**: Approval confirmation panel
- **StudentTopicDetailsPanel**: Student topic detail display
- **LecturerFeedbackPanel**: Feedback display panel
- **SubmissionDetailsPanel**: Submission metadata panel
- **SuperviseeDetailsPanel**: Supervisee detail panel
- **DecisionDetailsPanel**: Decision detail panel
- **AuditDetailsPanel**: Audit event detail panel
- **TopicDetailsPanel**: Topic detail display
- **AddUserButton**: Add user action button
- **ImportTopicsButton**: Import topics action
- **AddTopicButton**: Add topic action
- **SaveSettingsButton**: Save settings action
- **MessageReviewerButton**: Message reviewer action
- **DecisionActionPanel**: Decision action buttons (Approve/Request/Reject)
- **PasswordResetRequestForm**: Password reset form
- **PasswordCriteriaList**: Password requirement checklist
- **EditTopicForm**: Topic edit form
- **TopicSubmissionForm**: Topic submission form
- **TopicCheckForm**: Topic analysis form
- **RequestRevisionForm**: Revision request form
- **RejectForm**: Rejection reason form
- **ApproveCard**: Approve action card
- **ReportFilterPanel**: Report filter panel
- **ReportPreviewPanel**: Report preview panel
- **ThresholdSettingsPanel**: Threshold settings editor
- **AcademicSessionPanel**: Academic session manager
- **DepartmentSettingsPanel**: Department manager
- **ServiceStatusPanel**: Service status display
- **SettingsSection**: Settings section container
- **SettingsCard**: Settings configuration card
- **ResearchExplorerPanel**: Research explorer container
- **ReviewQueuePreview**: Quick review preview
- **UserDetailsPanel**: User detail form

**Total Reusable Components: 120+ identified**

---

## 9. Design-to-Code Rules

### Component Naming
- Use PascalCase for component names
- Use descriptive names that reflect function/purpose
- Avoid abbreviations except for common terms (e.g., CTA, UI, API)
- Suffix components with their type: `...Button`, `...Card`, `...Panel`, `...Form`, `...List`, `...Table`

### File Structure
```
src/
  components/
    shared/               # Shared/reusable components
      FormInputs/        # TextInput, SelectInput, etc.
      Buttons/           # PrimaryButton, SecondaryButton, etc.
      Cards/             # Card, StatusCard, etc.
      Tables/            # Table, UserTable, etc.
      Feedback/          # Alerts, modals, loading states
      Navigation/        # Sidebar, breadcrumbs, pagination
    layouts/             # Layout wrappers
      AuthSplitLayout
      StudentDashboardLayout
      LecturerDashboardLayout
      AdminDashboardLayout
    features/            # Feature-specific screen components
      Auth/
        LoginPage
      Student/
        DashboardPage
        SubmitTopicPage
        MySubmissionsPage
        CheckTopicPage
        ResearchExplorerPage
      Lecturer/
        DashboardPage
        PendingReviewPage
        MyDecisionsPage
        CheckSimilarityPage
        SuperviseesPage
        ResearchTrendsPage
      Admin/
        DashboardPage
        UserManagementPage
        TopicRepositoryPage
        SystemSettingsPage
        AuditLogPage
        ReportsPage
  hooks/                 # Custom React hooks
  utils/                 # Utility functions
  styles/                # Global styles, design tokens
  api/                   # API integration layer
  store/                 # State management (if needed)
```

### Styling & Design Tokens
- Use Tailwind CSS with custom design tokens for the UNIOSUN color palette
- Token naming: `color-{role}-{semantic}` (e.g., `color-primary-success`, `color-alert-danger`)
- Breakpoints: mobile-first, standard Tailwind breakpoints
- Spacing scale: Use consistent Tailwind spacing (4px, 8px, 12px, 16px, etc.)
- Typography: Define font scales (heading, subheading, body, caption)

### State Management
- Use React Context for role-based authentication state
- Use React hooks for component-level state (forms, filters, modals)
- Use query parameters for filter/pagination state (shareable URLs)
- Use URL-based state for routing (e.g., /admin/reports?session=S2024)

### Error Handling
- Validation errors: show inline feedback near input fields
- API errors: show banner alerts at page top
- System errors: show modal alerts with recovery actions
- Loading states: skeleton screens or spinners for data-dependent content

### Accessibility
- All interactive elements must have proper ARIA labels
- Color contrast ratios must meet WCAG AA standards
- Keyboard navigation must be fully supported
- Focus indicators must be visible
- Form labels must be associated with inputs

### Code Quality
- TypeScript for type safety
- ESLint + Prettier for code formatting
- Jest + React Testing Library for unit tests
- Target 70%+ test coverage (lines, branches, functions)
- No direct DOM manipulation; use React refs only when necessary

---

## 10. Visual QA Checklist

Before marking a screen as visually complete:

- [ ] Layout matches Figma frame (spacing, alignment, responsive behavior)
- [ ] Typography hierarchy matches Figma (sizes, weights, colors)
- [ ] Colors match UNIOSUN brand palette (primary, secondary, accents, neutrals)
- [ ] Component states are visually distinct (default, hover, active, disabled, error)
- [ ] Spacing/padding/margins align with 8px grid
- [ ] All icons are present and aligned correctly
- [ ] All badges/labels/status indicators match Figma styling
- [ ] Empty states and loading states are implemented
- [ ] Modals/overlays have proper backdrop and z-index
- [ ] Forms have proper error/success/validation styling
- [ ] Tables/lists render correctly with sample data
- [ ] Mobile responsiveness is tested (breakpoints: 480px, 768px, 1024px, 1280px)
- [ ] Dark mode (if applicable) is tested
- [ ] Accessibility: ARIA labels, focus indicators, keyboard nav
- [ ] No console errors or warnings
- [ ] Performance: component render time <100ms (use React DevTools Profiler)

---

## 11. Backend/API Dependency Summary

### Authentication API
- `POST /auth/login` - User sign-in
- `POST /auth/logout` - User sign-out
- `POST /auth/refresh` - Token refresh
- `GET /auth/me` - Current user profile

### Student APIs
- `GET /student/dashboard` - Dashboard data (topic status, feedback, activity)
- `POST /student/topics/submit` - Submit new topic
- `POST /student/topics/check` - Run similarity check on topic
- `GET /student/topics/check/:id` - Retrieve check results
- `GET /student/submissions` - List user's submissions
- `GET /student/submissions/:id` - Get submission detail
- `POST /student/submissions/:id/revise` - Revise submission
- `GET /student/explorer` - Research explorer data (approved topics, trends)

### Lecturer APIs
- `GET /lecturer/dashboard` - Dashboard data (pending reviews, alerts, activity)
- `GET /lecturer/pending-review` - List pending reviews
- `GET /lecturer/pending-review/:id` - Get review detail with similarity analysis
- `POST /lecturer/decisions/:id/approve` - Approve submission
- `POST /lecturer/decisions/:id/request-changes` - Request revision
- `POST /lecturer/decisions/:id/reject` - Reject submission
- `GET /lecturer/my-decisions` - List lecturer's decisions
- `GET /lecturer/supervisees` - List assigned supervisees
- `POST /lecturer/topics/check` - Check topic similarity
- `GET /lecturer/topics/check/:id` - Get check results

### Admin APIs
- `GET /admin/dashboard` - System health and metrics
- `GET /admin/users` - List all users
- `POST /admin/users` - Create new user
- `PUT /admin/users/:id` - Update user
- `DELETE /admin/users/:id` - Remove user
- `GET /admin/topic-repository` - List approved topics
- `POST /admin/topic-repository` - Add topic to repository
- `PUT /admin/topic-repository/:id` - Edit repository topic
- `DELETE /admin/topic-repository/:id` - Remove repository topic
- `POST /admin/import/topics` - Import topics from CSV/file
- `GET /admin/settings` - Get system settings
- `PUT /admin/settings` - Update system settings
- `GET /admin/audit-log` - List audit events
- `GET /admin/reports` - Generate reports/analytics

### Similarity Analysis APIs
- `POST /similarity/check` - Run similarity analysis on topic (called from student and lecturer)
- `GET /similarity/results/:id` - Get detailed similarity results

### Backend Data Models Required
- **Users**: id, email, role, status, profile (name, department, supervisor)
- **Topics**: id, title, text, category, supervisor, created_at, status, similarity_scores
- **Submissions**: id, user_id, topic_id, version, status, created_at, feedback, decision
- **Similarity Results**: id, submission_id, scores (jaccard, tfidf, sbert), risk_level, matched_topics
- **Audit Log**: id, actor_id, action, target, timestamp, details

---

## 12. PR/Branching Strategy for Implementation

### Branch Naming Convention
```
feature/{phase}/{screen-group}
  e.g., feature/phase-2/auth
        feature/phase-3/student-dashboard
        feature/phase-4/lecturer-pending-review
        feature/phase-5/admin-audit-log
```

### PR Structure
Each PR should include:
1. **Description**: Screen group, states covered, links to implementation plans
2. **Changes**: List of new components, modified layouts, new routes
3. **Testing**: Unit test coverage, visual QA checklist completion
4. **Screenshots**: Before/after comparison with Figma frames
5. **Deployment Impact**: Any new dependencies, configuration changes, API changes

### Commit Message Format
```
feat(phase-{N}-{screen-group}): {description}

- Implement {screen group} screen group with {N} states
- Add {component names}
- Connect to {API endpoints}

Closes #{issue-number}
```

### Review Checklist
- [ ] All required states are implemented
- [ ] Visual design matches Figma frames
- [ ] Components are properly reusable and typed (TypeScript)
- [ ] Forms have validation and error handling
- [ ] Loading/empty states are handled
- [ ] Accessibility requirements are met (ARIA, keyboard nav, contrast)
- [ ] Tests achieve 70%+ coverage for new code
- [ ] API endpoints are properly integrated or mocked
- [ ] No console errors or performance issues
- [ ] Mobile responsive design is tested
- [ ] Updated relevant documentation

### Release Strategy
- Phase 1-2: Internal development branch, no release
- Phase 3-5: Release v0.1-alpha after each phase completion
- Phase 6: Release v1.0-beta after all core screens complete
- v1.0 Launch: After all v1.0 and v1.0 placeholder screens pass QA
- v2.0 Planning: Start after v1.0 launch, parallel to any hotfixes

---

## Summary

**File created:** docs/frontend/figma-implementation-index.md

**Number of screen groups indexed:** 22 screen groups with 97 total states

**Main implementation phases:**
1. Phase 1: Foundation (weeks 1-2)
2. Phase 2: Authentication (weeks 2-3)
3. Phase 3: Student workflow (weeks 3-5)
4. Phase 4: Lecturer workflow (weeks 5-7)
5. Phase 5: Admin workflow (weeks 7-9)
6. Phase 6: Analytics/Reporting placeholders (weeks 9-10)

**Assumptions made:**
- v1.0 placeholder screens use mock/static/aggregated data for demonstration
- Phase estimates are sequential (can be parallelized with team capacity)
- Phase 1 (foundation) is critical and must complete before Phase 2
- All routes follow REST conventions with query parameters for state
- 120+ reusable components should be built incrementally during implementation
- Backend APIs exist or are mocked for v1.0 completion
