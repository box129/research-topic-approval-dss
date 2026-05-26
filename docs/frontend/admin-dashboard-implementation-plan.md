# Admin Dashboard Implementation Plan

## 1. Screen / State Summary

The Admin Dashboard is an admin-facing system overview page that displays service health, snapshot metrics, recent activity, and system-level alerts. It serves as the primary landing page for administrators and should demonstrate baseline system oversight.

States covered:
- System overview — default healthy dashboard state with normal metrics and activity feed.
- Degraded health alert — dashboard state when one or more services are slow, unstable, or partially unavailable.
- Critical outage — dashboard state when a major system dependency (e.g., database) is offline.

## 2. v1.0 Implementation Priority

All three states are v1.0 because they are essential to demonstrating system-level admin oversight and alerting:
- System overview state should render the default admin dashboard with service health, snapshot metrics, and recent activity.
- Degraded health alert state should render with a warning banner and alert visual context.
- Critical outage state should render with a critical error banner and graceful offline messaging.

Health states should be data-driven from backend/system health status during production, but mock or static state can be used first during UI implementation for demonstration and testing.

## 3. Component Breakdown

Suggested reusable components:
- `AdminDashboardLayout`
- `PageHeader`
- `DashboardStatusCard`
- `MetricCard`
- `SystemAlertCard`
- `RecentActivityFeed`
- `HighRiskTopicPreview`
- `PendingReviewSummary`
- `StatusBadge`
- `RiskBadge`
- `InfoCallout`
- `EmptyStatePanel`
- `PlaceholderPanel`

## 4. Route / State Mapping

Route:
- `/admin/dashboard`

State mapping:
- System overview is the default route state.
- Degraded health alert and critical outage are controlled by system health data/status flags.
- No separate route is required for each state; the page remains on the same route and switches visual states based on health data.
- The page may use internal health state management to render alert banners or placeholder panels.

## 5. Backend / API Dependency Notes

The Admin Dashboard should surface or query these backend-derived values:
- current admin profile (name, role, permissions)
- total users (count)
- total students (count)
- total lecturers (count)
- total topics (count)
- pending reviews (count)
- high-risk topics (count or summary)
- recent activity (list of recent events with timestamps)
- system health status (API health, database health, SBERT engine health)
- service availability (availability flags for each service)
- error/outage messages (if available from backend status endpoints)

## 6. Visual Matching Notes

The dashboard should evoke a clean, information-dense admin workspace with:
- a sidebar navigation and clean page header
- distinct system status indicator cards at the top (API, database, SBERT engine)
- a metric card panel showing snapshot counts (users, topics, pending, high-risk)
- a prominent recent activity feed below metrics
- clear visual distinction for health states: green for healthy, yellow for degraded, red for critical
- graceful placeholder or offline messaging for critical outage state
- alert banner positioning above the main dashboard content for warnings and outages

## 7. System Health Behavior Notes

The dashboard state management should:
- poll or subscribe to system health data (from backend health endpoints or live service monitoring)
- display healthy status cards with green success styling by default
- transition to a yellow/degraded alert banner and warning callout when one or more services report degradation
- transition to a red/critical error banner, disabled metrics panels, and placeholder content when major services are offline
- preserve the page structure and navigation even during critical outages
- provide clear messaging about which services are affected and when normal operation is expected to resume

## 8. Acceptance Checklist

- [ ] Route `/admin/dashboard` is implemented and accessible to admin users.
- [ ] System overview state renders with a page shell, header, service health cards, metric cards, and recent activity feed.
- [ ] Degraded health alert state renders with a yellow warning banner and adapts visual context accordingly.
- [ ] Critical outage state renders with a red error banner, disabled/placeholder metric panels, and graceful messaging.
- [ ] The page uses the proposed reusable components where appropriate.
- [ ] Health states can be demonstrated in v1.0 with mock health data or static state for testing.
- [ ] The page preserves navigation and basic structure even when services are unavailable.
