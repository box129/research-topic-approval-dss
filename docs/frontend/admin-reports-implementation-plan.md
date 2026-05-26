# Admin Reports Implementation Plan

## 1. Screen/State Summary
The Admin Reports page provides admins with comprehensive analytics and insights into topic submissions, approval decisions, similarity risk distribution, research trends, and system efficacy. All three states are v1.0 placeholder priorities, with actual report generation and export deferred to v2.0.

### States
- **Reports overview** (default): Dashboard with summary metrics, charts, trends, and system performance analytics.
- **Session-filtered report**: Reports and analytics filtered by academic session with updated visualizations.
- **Export PDF report / configuration modal**: Modal form to configure and generate PDF or CSV reports.

## 2. v1.0 Placeholder Implementation Priority
All three states are v1.0 placeholder. The page should visually exist with mock/static/simple aggregated data for demonstration. Real PDF/CSV export and advanced report generation are deferred to v2.0.

## 3. Component Breakdown
- AdminDashboardLayout
- PageHeader
- ReportSummaryCard
- ReportFilterPanel
- DateRangeFilter
- FilterDropdown
- ReportChart
- ReportTable
- ReportPreviewPanel
- ActiveFilterBanner
- ExportButton
- DownloadButton
- EmptyStatePanel
- PlaceholderPanel
- InfoCallout
- StatusBadge
- RiskBadge
- PrimaryButton
- SecondaryButton
- ConfirmActionModal

## 4. Route/State Mapping
- `/admin/reports` — Reports overview (default)
- `/admin/reports?session=...` — Session-filtered report
- `/admin/reports` + modal state — Export PDF report/configuration modal (no separate route)

## 5. Backend/API Dependency Notes
- total reports summary
- topic submission counts
- approval/rejection/revision counts
- similarity risk distribution
- academic session filter
- department/category filter
- user/lecturer/student statistics if available
- report table rows
- chart data
- export endpoint if available

## 6. Visual Matching Notes
- Dashboard-style layout with summary cards and chart panels
- Green brand palette with metric callouts
- Multiple chart types: heatmap, bar chart, line chart, data tables
- Session selector with preset defaults (e.g., "Last 3 Sessions")
- Filter banner for active session/filters
- Export buttons in header or footer
- Clear visual hierarchy for metrics and insights

## 7. Report/Export Behavior Notes
- Support session filtering and date range selection
- Allow report customization via modal (title, date range, sections)
- Provide export affordance visually (mocked if needed)
- Use mock/aggregated data for v1.0 demonstration
- Gracefully handle empty or unavailable analytics data

## 8. Deferred/v2.0 Notes
- Real PDF export and rendering
- CSV export and download
- Scheduled reports
- Advanced report generation
- Complex filtering and analysis
- Downloadable analytics
- Compliance-level reporting
- Long-term trend analysis
- Cross-session comparisons

## 9. Acceptance Checklist
- [ ] Reports overview displays summary metrics and charts
- [ ] Session-filtered report updates metrics and visualizations correctly
- [ ] Export PDF report modal appears and allows configuration
- [ ] All filter and session controls work or are mocked
- [ ] Export affordance is present (mocked if needed)
- [ ] Charts and tables render with mock/aggregated data
- [ ] Visuals match Figma audit and admin dashboard style
- [ ] All backend dependencies are handled or mocked for demo
