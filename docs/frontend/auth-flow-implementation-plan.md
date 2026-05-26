# Auth Flow Implementation Plan

## 1. Auth screen/state summary
This document summarizes the UNIOSUN Research Topic Similarity Detection System authentication flow as captured in `docs/frontend/figma-screen-state-audit.md`. It focuses on the Login screen group, including the default login state, inline error states, and related popup/modal recovery screens.

### Auth/Login screen group
- **AUTH-01**: Login
- Shared role entry point for students, lecturers, and administrators
- Core experience is a split-screen layout with branded left hero content and a right login form panel
- Related states include sign-in feedback, account lock notification, authentication processing, and recovery-related modal states

## 2. v1.0 implementation priority
### Core login states
- **Default login**: main sign-in page with email/password fields and primary button
- **Invalid credentials**: show inline login error and red validation styling for failed authentication attempts
- **Account locked**: show a top warning banner and disabled sign-in action when the account is temporarily locked after repeated failures
- **Signing in / processing**: transient overlay or modal state that appears during authentication submission

### v1.0 optional UI-only placeholders
- **Request reset**: password recovery initiation form state
- **Check your inbox**: success confirmation after requesting a reset link
- **Set new password**: reset password entry form with validation cues
- **Password updated**: success confirmation after changing the password
- **Validation error**: inline validation state on the reset password form
- **Link expired**: expired reset link notification with retry guidance

## 3. v2.0/deferred behavior
### Backend behavior deferred beyond initial UI plan
- **Real password reset email sending**: actual API call to send reset links
- **Real reset token validation**: secure verification of reset tokens before allowing password updates
- **Real password update through recovery link**: completing the reset flow with backend persistence and authentication state changes

## 4. Component breakdown
Suggested reusable components for implementation:
- `AuthSplitLayout`
- `AuthBrandPanel`
- `LoginForm`
- `AuthModal`
- `AuthStatusDialog`
- `TextInput`
- `PasswordInput`
- `PrimaryButton`
- `SecondaryLinkButton`
- `FeatureBulletList`
- `AuthFooterNote`

## 5. Route/state mapping
### Primary login routes/states
- `/login` → Default login page
- `/login?state=invalid-credentials` → Login page with invalid credentials feedback
- `/login?state=account-locked` → Login page with account lock warning
- `/login?state=signing-in` → Login page showing processing state overlay

### Recovery route/modal states
- `/forgot-password` → Password reset request state or modal
- `/reset-password` → Password reset form state or modal

## 6. Backend/API dependency notes
- The login page requires a backend authentication API endpoint for email/password sign-in
- Invalid credentials and account locked states can be handled via API error responses and UI mapping
- Signing-in state is a frontend transient state while the authentication request is pending
- Backend reset behavior is deferred to v2.0 and should be supported by password reset, token validation, and update endpoints when ready

## 7. Visual matching notes
- Match the Figma split-screen aesthetic with a dark green branded hero panel and a crisp white form panel
- Use gold/orange accent color for the primary CTA button and important actions
- Preserve generous spacing between hero content, form inputs, and buttons
- Keep typography hierarchy clear: bold product headline, supporting description, and labeled form fields
- Modal and status panels should feel lightweight and centered over the login page

## 8. Acceptance checklist
- [ ] Core login page renders at `/login` with branded split layout
- [ ] Email and password inputs display correctly with proper labels
- [ ] Primary login button is styled as a gold/orange CTA
- [ ] Invalid credentials state shows inline error messaging and field validation styling
- [ ] Account locked state displays a warning banner and disables sign-in action
- [ ] Signing in state shows a processing overlay or modal during submission
- [ ] Recovery placeholder states are documented and can be represented as modal/route variants
- [ ] Route/state mapping is defined for login and recovery states
- [ ] Backend dependency notes clearly separate v1.0 UI behavior from v2.0 backend reset behavior
