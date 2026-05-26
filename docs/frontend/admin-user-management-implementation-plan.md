# Admin User Management Implementation Plan

## 1. Screen / State Summary

The Admin User Management page is an admin-facing account and role management interface that allows admins to view, filter, search, and manage system users (students, lecturers, and other admins). It serves as the central hub for user lifecycle management and role assignment.

States covered:
- All users list — default user management state displaying users across all roles with filtering and action options.
- Filtered lecturer list — role-filtered view showing only lecturers, with additional selection and bulk action affordances.
- Add user modal — popup/modal state for inviting and creating a new user account with role and supervisor assignment.

## 2. v1.0 Implementation Priority

All three states are v1.0 because they are essential to demonstrating admin role/account management:
- All users list state should render the user management table with search, role tabs, status badges, and basic row-level actions.
- Filtered lecturer list state should render with a role filter applied, selection checkboxes, and bulk action options.
- Add user modal state should render as an overlay with fields for name, email, role selection, and optional supervisor assignment.

The v1.0 focus is on core user creation, filtering, and status management. Bulk import/export and advanced permission matrices should be deferred to v2.0.

## 3. Component Breakdown

Suggested reusable components:
- `AdminDashboardLayout`
- `PageHeader`
- `UserTable`
- `UserCard`
- `UserDetailsPanel`
- `RoleBadge`
- `StatusBadge`
- `SearchInput`
- `FilterDropdown`
- `AddUserButton`
- `AddUserModal`
- `EditUserForm`
- `ConfirmActionModal`
- `EmptyStatePanel`
- `PaginationControls`
- `PrimaryButton`
- `SecondaryButton`

## 4. Route / State Mapping

Route:
- `/admin/users`

State mapping:
- All users list is the default route state.
- Filtered lecturer list is controlled by role filter/query state (e.g., query param `?role=lecturer`); no separate route is required.
- Add user modal is controlled by local UI modal state (e.g., a modal visibility flag); no separate route is required.
- The page remains on the same route and switches visual content or modal visibility based on filter/selection state.

## 5. Backend / API Dependency Notes

The Admin User Management page should query or surface these backend-derived values:
- current admin profile (name, role, permissions)
- list of users (paginated, searchable, filterable)
  - user id
  - name
  - email
  - role (student, lecturer, admin)
  - department (if available)
  - account status (active, inactive, invited, suspended)
  - created date
  - last active date (if available)
- search parameters (full-text search across name and email)
- filter parameters (role filter, status filter)
- pagination metadata (page size, current page, total count)
- create user endpoint (for add user modal)
- update user endpoint (for status changes or edits if available)
- activate/deactivate user endpoint (if available for status management)

## 6. Visual Matching Notes

The user management page should evoke a clean, data-focused admin interface with:
- a sidebar navigation and clean page header with a prominent "Add User" button
- a search bar above the user table for filtering by name or email
- role-based tabs or filter selectors to filter the user list (All, Students, Lecturers, Admins)
- a standard data table with columns for name, email, role, status, supervisor (for students), and last active
- color-coded status badges (e.g., green for active, gray for inactive, yellow for invited)
- row-level action links (view details, edit, activate/deactivate)
- pagination controls at the bottom for large user lists
- selection checkboxes when a filter is active to support bulk actions
- a modal overlay for the "Add User" form with role-dependent field visibility

## 7. User Management Behavior Notes

The user management page should:
- display all users by default with basic pagination and search
- support filtering by role (Students, Lecturers, Admins) via tab or dropdown selector
- enable search across name and email fields with real-time or submit-based filtering
- show status badges (Active, Inactive, Invited, Suspended) for each user
- provide row-level actions (view details, edit, activate, deactivate) if implemented
- render the Add User modal with form fields for full name, university email, role dropdown, and supervisor selector (only visible when role is Student)
- send user invitations after form submission
- support pagination for large user lists to keep the page performant

## 8. Acceptance Checklist

- [ ] Route `/admin/users` is implemented and accessible to admin users.
- [ ] All users list state renders with a page shell, search bar, role tabs, user table with columns, and pagination.
- [ ] Filtered lecturer list state renders with an active filter applied and selection checkboxes for bulk action affordances.
- [ ] Add user modal state renders as an overlay with form fields for name, email, role, and supervisor (conditional on role).
- [ ] The page uses the proposed reusable components where appropriate.
- [ ] Search and role filtering work with backend queries or mock data for v1.0 demonstration.
- [ ] Status badges and row-level action links are visually distinct and functional.
- [ ] The page can be demonstrated in v1.0 with mock user data for testing workflows.
- [ ] Bulk import/export and advanced permission matrices are documented as deferred to v2.0.
