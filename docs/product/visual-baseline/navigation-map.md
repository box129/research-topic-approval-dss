# Navigation Map

Role-specific navigation in the accepted tree
(`staging/render-acceptance` @ `ff833cf0bc645bd4678bf480bb3c4070216f78cf`).
Arrows show the ordinary path a user follows; every authenticated page also
carries the role navigation bar and the notification bell.

## Public

```
/                       Landing (product overview, sign-in link)
/login                  Sign in — email address OR matric number
/forgot-password        Request reset link (email on record required)
/reset-password         Set a new password from the emailed link
/accept-invitation      Activate an invited account
/change-password        Forced first-login / post-reset password change
```

## STUDENT

```
login
 └─► /student/dashboard              Current submission, status, what happens next
      ├─► /student/check-my-topic     Check My Topic (advisory similarity, structured context)
      ├─► /student/submit-topic       Submit Topic → review-before-submit → confirm
      └─► /student/my-submissions     My Submissions (status, feedback, history)
            └─► submission card       Submission detail: feedback · research context · revision history
                  └─► /student/my-submissions/:id/revise
                                      Revise and Resubmit (pre-filled) → confirm → linked revision
                        └─► decision  Approved / Rejected / Revision required (notification + card)
```

Navigation bar: Dashboard · Submit Topic · My Submissions · Check My Topic.

**Research Explorer** (`/student/research-explorer`): **DEFERRED / NOT
ADVERTISED IN PILOT.** The route exists and shows an honest "not currently
available" placeholder; it is not in the navigation bar.

## LECTURER

```
login
 └─► /lecturer/dashboard             Queue overview
      ├─► /lecturer/pending-reviews   Pending Reviews (student name · matric · email when present · revision marker)
      │     └─► /lecturer/pending-reviews/:id
      │           Review detail: submitted topic · research context · revision context
      │           · similarity check (advisory) · decision with rationale
      │           · Approve / Request Revision / Reject → confirm
      ├─► /lecturer/my-decisions      My Decisions (history, filters, pagination)
      ├─► /lecturer/supervisees       Supervisees (admin-assigned students)
      ├─► /lecturer/check-similarity  Check Similarity (direct checker)
      └─► /lecturer/research-trends   Research Trends (read-only aggregate)
```

Navigation bar: Dashboard · Pending Reviews · Check Similarity · My Decisions ·
Supervisees · Research Trends.

## ADMIN

```
login
 └─► /admin/dashboard                Service health · metrics
      ├─► /admin/user-management      Users: search · create (student matric-first / lecturer email)
      │                               · identity correction · suspend/reactivate · credential reset
      │                               · invitation (email accounts only)
      │                               · bulk onboarding: upload → preview → commit → one-time manifest
      │                               · bulk invitations · supervisee assignments
      ├─► /admin/topic-repository     Historical / current-session / under-review topics · import
      ├─► /admin/system-settings      Effective non-secret settings and capability status
      ├─► /admin/audit-log            Governance trail · detail · purge preview/purge
      └─► /admin/reports              Summary · exports
```

Navigation bar: Dashboard · User Management · Topic Repository · System
Settings · Audit Log · Reports.

## Operator-only (no navigation)

First-admin bootstrap, migrations, backup/restore, health/readiness endpoints,
release-readiness gate — see `docs/operations/hosting-decision-runbook.md`.
