# Lecturer Research Trends Implementation Plan

## 1. Screen / State Summary

The Lecturer Research Trends page is a lecturer-facing analytics dashboard that should be visually available in v1.0 as a placeholder experience. It is intended to support research oversight by showing trend-oriented visuals and summary metrics, while full analytics remain deferred to later releases.

States covered:
- Overview summary — default analytics dashboard state.
- Filtered focus view — discipline- or focus area-specific analytics state.
- No trend data — fallback when analytics are unavailable or insufficient.

## 2. v1.0 Placeholder Implementation Priority

This page should exist visually in v1.0, but it should not require complete data or advanced analytics. The primary delivery goal is:
- Deliver a Lecturer Research Trends route and page shell.
- Render the three states with placeholder, static, or simple aggregated content.
- Support the default dashboard state, a filtered focus state, and a no-data state.

The following should be deferred to v2.0 unless already implemented:
- real PDF export
- advanced heatmap analytics
- keyword clustering engine
- supervisor workload analytics
- trend prediction
- complex reporting charts
- downloadable reports

## 3. Component Breakdown

Suggested reusable components:
- `LecturerDashboardLayout`
- `PageHeader`
- `SegmentControl`
- `MetricCard`
- `HeatmapPanel`
- `TrendChart`
- `WorkloadPanel`
- `KeywordChipGroup`
- `DataTable`
- `StatusTable`
- `ActiveFilterBanner`
- `EmptyStatePanel`
- `PlaceholderPanel`
- `InfoCallout`
- `ExportButton`

## 4. Route / State Mapping

Route:
- `/lecturer/research-trends`

State mapping:
- Overview summary is the default route state.
- Filtered focus view is controlled by selected filter/query state; no separate route is required unless the codebase already uses route-driven state patterns.
- No trend data is controlled by missing or insufficient analytics data.
- The page may remain on the same route and switch visual states through query/selection state.

## 5. Backend / API Dependency Notes

The page may surface or mock these backend-derived values:
- reviewed topics count
- approved and rejected counts
- average risk across reviewed topics
- selected session scope
- discipline/category distribution
- trend points over time
- supervisor workload data
- keyword clusters
- recent submissions, if available
- analytics availability status

For a v1.0 placeholder, use simple aggregated values or mock summaries for these items.

## 6. Visual Matching Notes

The page should evoke a dashboard-style analytics workspace with:
- a clean lecturer dashboard layout and page header
- segmented scope controls or tabs for session/time range selection
- summary metric cards at the top
- distinct panels for concentration, trend charts, workload, and keyword clusters
- an active filter banner in filtered view
- clear placeholder panels for no-data state
- a subdued export report action that is visually present but treated as v2.0 functionality

## 7. Deferred / v2.0 Analytics Notes

The following features should be treated as v2.0 enhancements:
- real PDF export functionality
- advanced heatmap analytics and data interactions
- keyword clustering engine and cluster visualization
- supervisor workload analytics beyond simple cards
- predictive trend or forecast computation
- complex reporting charts and drill-down visualizations
- downloadable or shareable analytics reports

## 8. Acceptance Checklist

- [ ] Route `/lecturer/research-trends` is implemented and accessible.
- [ ] Overview summary state renders with a page shell, header, metric cards, and placeholder analytics panels.
- [ ] Filtered focus view state renders with an active filter banner and adapted placeholder content.
- [ ] No trend data state renders gracefully with empty/pending visuals and clear messaging.
- [ ] The page uses the proposed reusable components where appropriate.
- [ ] The page can be visually demonstrated in v1.0 without requiring full analytics.
- [ ] Full analytics items are documented as deferred to v2.0 and not relied on for initial delivery.
