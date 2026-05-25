# Admin System Settings Implementation Plan

## 1. Screen/State Summary
The Admin System Settings area allows admins to view and edit system configuration, including similarity thresholds, academic sessions, departments, and service toggles. Three states: Settings overview (v1.0), Thresholds editor (v1.0), Sessions & services panel (v1.0 placeholder).

### States
- **Settings overview**: Dashboard-style overview of all configuration areas.
- **Thresholds editor**: Edit similarity thresholds and algorithm weights.
- **Sessions & services panel**: Manage academic sessions, departments, and service toggles (visual only in v1.0 if backend is unavailable).

## 2. v1.0 and v1.0 Placeholder Implementation Priority
- Settings overview: v1.0
- Thresholds editor: v1.0
- Sessions & services panel: v1.0 placeholder (visuals exist, full automation may be deferred)

## 3. Component Breakdown
- AdminDashboardLayout
- PageHeader
- SettingsSection
- SettingsCard
- ThresholdSettingsPanel
- AcademicSessionPanel
- DepartmentSettingsPanel
- ServiceStatusPanel
- ToggleSwitch
- NumberInput
- SelectInput
- SaveSettingsButton
- InfoCallout
- StatusBadge
- ConfirmActionModal

## 4. Route/State Mapping
- `/admin/settings` — Settings overview (default)
- `/admin/settings/thresholds` — Thresholds editor
- `/admin/settings/sessions` — Sessions & services panel

## 5. Backend/API Dependency Notes
- current admin profile
- similarity thresholds (Jaccard, TF-IDF, SBERT weights)
- low/medium/high risk thresholds
- active academic sessions
- department list
- service endpoint/status
- maintenance mode flag
- save settings endpoint
- validation rules

## 6. Visual Matching Notes
- Card/section layout for each configuration area
- Inline editing for thresholds and toggles
- Save/apply controls at section or page level
- Use admin dashboard visual style

## 7. Settings Behavior Notes
- Allow editing and saving of thresholds and toggles
- Validate inputs before save
- Use default/mock values if backend is unavailable
- Confirm changes with modal if needed
- Sessions/services panel is visual in v1.0 if backend is incomplete

## 8. Deferred/v2.0 Notes
- Full automation for academic sessions, departments, and service endpoints
- Advanced validation and error handling
- Audit trail for settings changes
- Integration with external services

## 9. Acceptance Checklist
- [ ] Settings overview displays all configuration areas
- [ ] Thresholds editor allows editing and saving of weights/thresholds
- [ ] Sessions & services panel is visually present
- [ ] All inputs are validated before save
- [ ] Save/apply controls work or are mocked
- [ ] Visuals match Figma audit and admin dashboard style
- [ ] All backend dependencies are handled or mocked for demo
