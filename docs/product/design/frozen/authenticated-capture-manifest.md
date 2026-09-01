# Authenticated product — real pixel capture pack

Captured 2026-08-31T06:28:43.844Z from the running dev stack (Vite @5173 → backend @3000, branch design/prepilot-ux-revamp).
All data is synthetic demo/seed data. No real departmental records. No product code was modified.

Hard-to-reach similarity states were produced by two additional instances of the SAME backend code:
- `:3001` — scratch database (migrations + demo users, zero topics) → honest "no eligible corpus" response.
- `:3002` — `VOYAGE_API_KEY` unset, same synthetic corpus → honest `semantic_unavailable` response.
For those two captures only the similarity-check request was forwarded to the auxiliary instance; every other request hit the primary dev backend.

| Screenshot | Route | Role | Viewport | State | Setup / source | Notes |
|---|---|---|---|---|---|---|
| student-dashboard-desktop.png | /student/dashboard | student | 1440px | Dashboard, populated with demo submission history | Seeded demo data, real API — real API |  |
| student-check-initial-desktop.png | /student/check-my-topic | student | 1440px | Initial/default state, empty form | None — real API |  |
| student-check-validation-error-desktop.png | /student/check-my-topic | student | 1440px | Client-side validation error: 4-word title below the 7-word minimum; submit disabled | Typed a deliberately short title — real UI validation (no API call) |  |
| student-check-high-desktop.png | /student/check-my-topic | student | 1440px | Populated HIGH similarity result | Live check against seeded synthetic corpus (real Voyage query embedding) — real API | Actual API classification: HIGH, max similarity 0.7206525778154617. Near-duplicate of seeded historical topic #1. |
| student-check-high-mobile.png | /student/check-my-topic | student | 390px | Populated HIGH similarity result | Same result re-rendered at mobile viewport (no re-check) — real API | Actual API classification: HIGH, max similarity 0.7206525778154617. Near-duplicate of seeded historical topic #1. |
| student-check-low-desktop.png | /student/check-my-topic | student | 1440px | Populated LOW similarity result | Live check with an out-of-domain topic (real Voyage query embedding) — real API | Actual API classification: LOW, max similarity 0.2673686509412847. |
| student-check-empty-corpus-desktop.png | /student/check-my-topic | student | 1440px | No eligible corpus: nothing available to compare against | Same backend code on :3001 against a scratch DB with migrations + demo users and zero topics; only the check request was forwarded there — real API (safe test harness) | API returned corpus_size 0, overall_risk null (no classification asserted). |
| student-check-empty-corpus-mobile.png | /student/check-my-topic | student | 390px | No eligible corpus: nothing available to compare against | Same result re-rendered at mobile viewport — real API (safe test harness) | API returned corpus_size 0, overall_risk null (no classification asserted). |
| student-check-provider-unavailable-desktop.png | /student/check-my-topic | student | 1440px | Semantic provider unavailable / similarity unavailable | Same backend code on :3002 with VOYAGE_API_KEY unset, same synthetic corpus; only the check request was forwarded there — real API (safe test harness) | API returned HTTP 503 status semantic_unavailable; provider failure is explicit, no fallback. |
| student-check-provider-unavailable-mobile.png | /student/check-my-topic | student | 390px | Semantic provider unavailable / similarity unavailable | Same result re-rendered at mobile viewport — real API (safe test harness) | API returned HTTP 503 status semantic_unavailable; provider failure is explicit, no fallback. |
| student-submit-populated-desktop.png | /student/submit-topic | student | 1440px | Submit Topic form fully populated (not submitted) | Synthetic topic typed into the form — real UI |  |
| student-submit-populated-mobile.png | /student/submit-topic | student | 390px | Submit Topic form fully populated (not submitted) | Same form state at mobile viewport — real UI |  |
| student-submit-review-step-desktop.png | /student/submit-topic | student | 1440px | Review-before-submit step (the pre-submit evidence/confirmation state); NOT confirmed | Clicked "Review and submit"; no submission was created — real UI |  |
| student-my-submissions-desktop.png | /student/my-submissions | student | 1440px | My Submissions populated: 7 seeded submissions across approved / rejected / pending / awaiting-revision | Seeded demo submissions — real API |  |
| student-revise-requested-desktop.png | /student/my-submissions/3/revise | student | 1440px | Revision-requested state: lecturer feedback panel + prefilled revision form (submission #3, AWAITING_REVISION) | Seeded awaiting-revision submission; nothing resubmitted — real API | Seeded submission #3 has no stored decision reason, so the honest "No feedback was recorded with this request." fallback renders. |
| lecturer-dashboard-desktop.png | /lecturer/dashboard | lecturer | 1440px | Dashboard, populated | Seeded demo data — real API |  |
| lecturer-pending-reviews-desktop.png | /lecturer/pending-reviews | lecturer | 1440px | Pending Reviews populated (submission #6 pending) | Seeded demo submissions — real API |  |
| lecturer-review-pending-desktop.png | /lecturer/pending-reviews/6 | lecturer | 1440px | Review Detail, pending, similarity evidence visible (fresh advisory check + saved snapshot history) | Real "Run Similarity Check" on pending submission #6 (live Voyage query embedding; snapshot persisted by the app as designed) — real API |  |
| lecturer-review-pending-mobile.png | /lecturer/pending-reviews/6 | lecturer | 390px | Review Detail, pending, similarity evidence visible | Same state at mobile viewport — real API |  |
| lecturer-review-decision-controls-desktop.png | /lecturer/pending-reviews/6 | lecturer | 1440px | Review Detail: decision controls (Approve / Request Revision / Reject) enabled for a pending submission | Scrolled to the Lecturer Decision section — real API |  |
| lecturer-review-revision-rationale-desktop.png | /lecturer/pending-reviews/6 | lecturer | 1440px | Revision rationale typed + confirmation modal open; decision NOT confirmed (cancelled afterwards) | Typed synthetic rationale, clicked Request Revision, cancelled the modal — real UI |  |
| lecturer-review-decided-desktop.png | /lecturer/pending-reviews/5 | lecturer | 1440px | Recorded/completed decision: rejected submission #5 with stored rationale, disabled actions, and saved HIGH similarity snapshot history | Seeded decided submission — real API |  |
| admin-dashboard-desktop.png | /admin/dashboard | admin | 1440px | Dashboard, populated | Seeded demo data — real API |  |
| admin-topic-repository-desktop.png | /admin/topic-repository | admin | 1440px | Topic Repository populated (9 seeded synthetic topics across lifecycle buckets) | Seeded demo comparison corpus — real API |  |
| admin-topic-repository-mobile.png | /admin/topic-repository | admin | 390px | Topic Repository at mobile viewport (actual table behaviour) | Same page at mobile viewport — real API |  |
| admin-user-management-desktop.png | /admin/user-management | admin | 1440px | User Management populated (3 demo accounts) | Seeded demo users — real API |  |
| admin-bulk-preview-desktop.png | /admin/user-management | admin | 1440px | Bulk onboarding preview result (nothing committed; no accounts created) | Synthetic 5-row .xlsx (3 matric-first students, 1 lecturer, 1 deliberately invalid row); preview endpoint only — real API |  |
| login-desktop.png | /login | unauthenticated | 1440px | Login page default state | None — real UI |  |
