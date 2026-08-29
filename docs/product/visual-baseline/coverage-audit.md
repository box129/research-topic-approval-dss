# Visual Completeness Audit — Feature Inventory vs Captured Media

Cross-check of every row in [`../current-feature-inventory.md`](../current-feature-inventory.md)
against the screenshots in `screenshots/` and the walkthrough videos listed in
`videos/MANIFEST.md`. Application source baseline
`ff833cf0bc645bd4678bf480bb3c4070216f78cf`; capture and recording date 29 Aug 2026;
synthetic data only.

Coverage levels:

- **FULL** — the feature's main screen *and* its primary action are shown.
- **PARTIAL** — the feature is visible (entry point, control or state) but its action
  or a secondary state was not exercised on camera.
- **NOT CAPTURED** — no media; reason given.
- **N/A** — no user interface by design (deferred, or operator-only), documented elsewhere.

## Student

| Feature | Status | Screenshots | Video | Coverage |
| --- | --- | --- | --- | --- |
| Sign in | IMPLEMENTED | `03-login.png` | 02 | FULL |
| Forced password change | IMPLEMENTED | `05-forced-password-change.png` | 02 | FULL |
| Forgot / reset password | IMPLEMENTED | `04-forgot-password.png` (request form) | — | PARTIAL — the token-bearing reset page was not captured (it would display a live one-time link) |
| Accept invitation | IMPLEMENTED | — | — | NOT CAPTURED — the acceptance page is reached only through a token-bearing email link; not captured rather than showing a live token |
| Dashboard | IMPLEMENTED | `10-student-dashboard.png` | 02 | FULL |
| Check My Topic | IMPLEMENTED | `11-student-check-topic-empty.png`, `12-student-check-topic-results.png`, `70-empty-corpus-honesty.png`, `71-semantic-provider-unavailable.png` | 02 | FULL (including the empty-corpus and provider-unavailable states) |
| Submit Topic | IMPLEMENTED | `13-student-submit-topic.png`, `14-student-submit-review.png`, `15-student-submission-pending.png` | 02 | FULL |
| My Submissions | IMPLEMENTED | `20-student-my-submissions.png`, `73-no-submissions.png`, `15`/`16`/`19` (per-status cards) | 02 | FULL |
| Revise and Resubmit | IMPLEMENTED | `16-student-submission-revision-required.png`, `17-student-revise-prefilled.png`, `18-student-revised-submission.png` | 02 | FULL |
| Notifications | IMPLEMENTED | Header bell with unread count visible in `10`, `20` and every signed-in capture | 02 (header) | PARTIAL — the notification panel itself was not opened on camera |
| Research Explorer | DEFERRED | — | — | N/A — deferred; not advertised in the pilot, deliberately not captured |

## Lecturer

| Feature | Status | Screenshots | Video | Coverage |
| --- | --- | --- | --- | --- |
| Sign in | IMPLEMENTED | `03-login.png` (shared login) | 03 | FULL |
| Dashboard | IMPLEMENTED | `30-lecturer-dashboard.png` | 03 | FULL |
| Pending Reviews | IMPLEMENTED | `31-lecturer-pending-reviews.png`, `72-no-pending-reviews.png` | 03 | FULL |
| Review Detail | IMPLEMENTED | `32-lecturer-review-detail.png` | 03 | FULL |
| Similarity evidence on a submission | IMPLEMENTED | `33-lecturer-review-similarity-context.png` | 03 | FULL |
| Decision: Approve / Request Revision / Reject | IMPLEMENTED | `34-lecturer-request-revision.png`, `36-lecturer-approve.png` | 03 | PARTIAL — Request Revision and Approve are shown with their rationale dialogs; the Reject path was not exercised on camera |
| Revision context | IMPLEMENTED | `35-lecturer-revised-submission.png` | 03 | FULL |
| My Decisions | IMPLEMENTED | `37-lecturer-my-decisions.png` | 03 | FULL (see defect VB-4) |
| Supervisees | IMPLEMENTED | `38-lecturer-supervisees.png` | 03 | FULL (see defect VB-5) |
| Check Similarity | IMPLEMENTED | `39-lecturer-similarity-checker.png` | 03 | FULL (see defect VB-1) |
| Research Trends | IMPLEMENTED | `40-lecturer-research-trends.png` | 03 | FULL |
| Notifications | IMPLEMENTED | Header bell in every lecturer capture | 03 (header) | PARTIAL — panel not opened on camera |

## Departmental Administrator

| Feature | Status | Screenshots | Video | Coverage |
| --- | --- | --- | --- | --- |
| Sign in | IMPLEMENTED | `03-login.png` (shared login) | 01, 04 | FULL |
| Dashboard | IMPLEMENTED | `50-admin-dashboard.png` | 04 | FULL |
| User Management — list | IMPLEMENTED | `51-admin-user-management.png`, `58`, `59` (filtered rows) | 04 | FULL |
| Create user | IMPLEMENTED | `52-admin-create-student-no-email.png`, `53-admin-create-lecturer.png` (credential masked) | 04 | FULL |
| Identity correction | IMPLEMENTED | "Edit identity" row action visible in `51`, `58`, `59` | 04 (row action visible) | PARTIAL — the correction dialog was not exercised on camera |
| Suspend / reactivate | IMPLEMENTED | "Suspend account" row action visible in `51`, `58`, `59` | 04 (row action visible) | PARTIAL — not exercised on camera; the demo cohort has no suspended account |
| Credential reset | IMPLEMENTED | `59-admin-credential-reset.png` (masked) | 04 | FULL |
| Invitation | IMPLEMENTED | `58-admin-invitation-action.png`, `75-no-email-invitation-skip.png` | 04 | FULL (including the truthful refusal for an account without an email) |
| Bulk onboarding — preview / commit | IMPLEMENTED | `54-admin-bulk-import.png`, `55-admin-bulk-preview.png`, `56-admin-bulk-result.png`, `57-admin-credential-manifest-state.png`, `74-import-conflict.png` | 04 | FULL |
| Bulk invitations | IMPLEMENTED | Optional post-commit section visible in `57` | 04 (section visible) | PARTIAL — the bulk send was not triggered on camera |
| Supervisee assignments | IMPLEMENTED | Assignment cards visible in `54` | 04 (cards visible) | PARTIAL — assignments for the demo cohort were created before capture; the assign action itself is not shown |
| Topic Repository | IMPLEMENTED | `60-admin-topic-repository.png` | 04 | FULL |
| System Settings | IMPLEMENTED | `61-admin-settings.png` | 04 | FULL |
| Audit Log | IMPLEMENTED | `62-admin-audit-log.png` | 04 | FULL |
| Reports | IMPLEMENTED | `63-admin-reports.png` | 04 | FULL |
| Notifications | IMPLEMENTED | Header bell in every admin capture | 04 (header) | PARTIAL — panel not opened on camera |

## Operator-only (no user interface)

| Feature | Status | Documented in | Coverage |
| --- | --- | --- | --- |
| First-administrator bootstrap | OPERATOR-ONLY | `docs/operations/hosting-decision-runbook.md` (A2/A3, B2) | N/A — command-line only |
| Database migrations | OPERATOR-ONLY | hosting-decision-runbook (A2/A3, B2) | N/A |
| Logical backup / restore | OPERATOR-ONLY | `docs/operations/` backup and restore runbook | N/A |
| Health / readiness endpoints | OPERATOR-ONLY | hosting-decision-runbook checklists (A4, B4) | N/A — the admin dashboard's service-health panel (`50`) is the only UI reflection |
| Release readiness gate | OPERATOR-ONLY | hosting-decision-runbook (A3, B2) | N/A |
| Embedding backfill | OPERATOR-ONLY | hosting-decision-runbook (A3, B2) | N/A |

## Totals

| Coverage | Rows |
| --- | --- |
| FULL | 28 |
| PARTIAL | 9 |
| NOT CAPTURED | 1 (Accept invitation) |
| N/A — deferred by design | 1 (Research Explorer) |
| N/A — operator-only | 6 |
| **Inventory rows** | **45** |

Every IMPLEMENTED feature except *Accept invitation* has at least an entry-point
capture; the nine PARTIAL rows are secondary actions or states that were not exercised
on camera and are listed as remaining visual gaps in the README. No capture was
skipped because of a product defect; the defects noticed while capturing are recorded,
unfixed, in [`observed-defects.md`](observed-defects.md).
