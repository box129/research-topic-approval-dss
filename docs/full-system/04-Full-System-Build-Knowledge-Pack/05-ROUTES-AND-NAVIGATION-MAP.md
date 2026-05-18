# 05 — Routes and Navigation Map

> **Source:** `Navigation-Structure.md`, `Screen-Inventory.md`, all screen breakdown files

---

## Auth Routes (Public — No Authentication Required)

| Method | Route | Screen | Notes |
|---|---|---|---|
| GET | `/login` | AUTH-01 Login | Redirect to role dashboard if already authenticated |
| GET | `/forgot-password` | AUTH-02 Forgot Password | Public |
| GET | `/reset-password?token=...` | AUTH-03 Reset Password | Token validated on load |
| POST | `/api/v1/auth/login` | — | Sets `rtadss_session` httpOnly cookie and returns safe user profile with role |
| POST | `/api/v1/auth/logout` | — | Clears `rtadss_session` cookie |
| POST | `/api/v1/auth/forgot-password` | — | Uses mock email provider to generate reset link |
| POST | `/api/v1/auth/reset-password` | — | Validates token, sets new password |

---

## Role-Based Routing After Login

On successful authentication the backend sets the `rtadss_session` httpOnly cookie and returns a safe user profile with role. The frontend redirects immediately from that profile or from `GET /api/v1/auth/me` using `withCredentials: true` — the user never sees a role selector.

```
Login success
    ↓
Read role from safe user profile or /auth/me
    ↓
role === "lecturer"  →  /lecturer/dashboard
role === "student"   →  /student/dashboard
role === "admin"     →  /admin/dashboard
```

If an authenticated user navigates to a route they do not have access to, they are redirected to their own dashboard. Do not show a 403 error page — silently redirect.

---

## Lecturer Routes (Requires auth + role = "lecturer")

| Route | Screen | Notes |
|---|---|---|
| `/lecturer/dashboard` | L1 — Lecturer Dashboard | Default landing after login |
| `/lecturer/pending-reviews` | L2 — Pending Reviews | Queue — defaults to "My Assigned" view |
| `/lecturer/pending-reviews/:topicId` | L3 — Similarity Results & Decision | Drill-in from L2 |
| `/lecturer/my-decisions` | L4 — My Decisions | History of all decisions |
| `/lecturer/check-similarity` | L5 — Check Similarity | Standalone checker |
| `/lecturer/supervisees` | L6 — Supervisees | Assigned students overview |
| `/lecturer/research-trends` | L7 — Research Trends | v2.0 — render placeholder for now |

### Lecturer Sidebar Navigation

```
[Logo + System Name]

Dashboard               ← /lecturer/dashboard
Pending Reviews         ← /lecturer/pending-reviews
Check Similarity        ← /lecturer/check-similarity
My Decisions            ← /lecturer/my-decisions
Supervisees             ← /lecturer/supervisees
Research Trends         ← /lecturer/research-trends  (v2.0 — show placeholder)

                        [Avatar ▾] (top right — Profile dropdown)
```

**Active item:** highlighted with primary green `#10B981` underline/indicator
**Profile dropdown items:** Account Details, Change Password, Notification Preferences, Sign Out

---

## Student Routes (Requires auth + role = "student")

| Route | Screen | Notes |
|---|---|---|
| `/student/dashboard` | St1 — Student Dashboard | Default landing after login |
| `/student/submit-topic` | St2 — Submit Topic | 3-step flow |
| `/student/my-submissions` | St3 — My Submissions | Full history |
| `/student/my-submissions?submission=:id` | St3 — My Submissions | Deep link — auto-expands specified submission |
| `/student/check-my-topic` | St4 — Check My Topic | Standalone pre-check |
| `/student/research-explorer` | St5 — Research Explorer | v2.0 — render placeholder for now |

### Student Sidebar Navigation

```
[Logo + System Name]

Dashboard               ← /student/dashboard
Submit Topic            ← /student/submit-topic
My Submissions          ← /student/my-submissions
Check My Topic          ← /student/check-my-topic
Research Explorer       ← /student/research-explorer  (v2.0 — show placeholder)

                        [Avatar ▾] (top right — Profile dropdown)
```

---

## Admin Routes (Requires auth + role = "admin")

| Route | Screen | Notes |
|---|---|---|
| `/admin/dashboard` | A1 — Admin Dashboard | Default landing after login |
| `/admin/user-management` | A2 — User Management | User CRUD |
| `/admin/topic-repository` | A3 — Topic Repository | Data management |
| `/admin/system-settings` | A4 — System Settings | Configuration |
| `/admin/audit-log` | A5 — Audit Log | Event log |
| `/admin/reports` | A6 — Reports | v2.0 — render placeholder for now |

### Admin Sidebar Navigation

```
[Logo + System Name]

Dashboard               ← /admin/dashboard
User Management         ← /admin/user-management
Topic Repository        ← /admin/topic-repository
System Settings         ← /admin/system-settings
Audit Log               ← /admin/audit-log
Reports                 ← /admin/reports  (v2.0 — show placeholder)

                        [Avatar ▾] (top right — Profile dropdown)
```

---

## API Routes (Backend)

### Authentication
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/login` | Authenticate user, set httpOnly cookie, return safe user profile with role |
| POST | `/api/v1/auth/logout` | Clear httpOnly session cookie |
| POST | `/api/v1/auth/forgot-password` | Generate reset link through mock email provider |
| POST | `/api/v1/auth/reset-password` | Validate token, update password |
| GET | `/api/v1/auth/me` | Return current user profile |

### Similarity Engine (MVP — preserve)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/similarity/check` | Run tri-algorithm similarity check (existing MVP endpoint) |
| POST | `/api/v1/check-similarity` | Run tri-algorithm similarity check (v1 alias) |
| POST | `/embed` | Internal — SBERT embedding service |
| GET | `/api/v1/health` | System health check |

### Topics & Submissions (new for v1.0)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/submissions` | List submissions (filtered by role) |
| POST | `/api/v1/submissions` | Student creates a new submission |
| GET | `/api/v1/submissions/:id` | Get submission detail |
| PATCH | `/api/v1/submissions/:id/status` | Update submission status |
| POST | `/api/v1/submissions/:id/decision` | Lecturer records a decision |
| GET | `/api/v1/topics` | List topics (historical repository) |
| POST | `/api/v1/topics` | Admin adds a topic manually |
| POST | `/api/v1/topics/import` | Admin bulk imports topics |
| GET | `/api/v1/topics/duplicates` | Admin runs duplicate scan |

### Users (new for v1.0)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/users` | Admin lists all users |
| POST | `/api/v1/users` | Admin creates a user |
| PATCH | `/api/v1/users/:id` | Admin edits role or status |
| DELETE | `/api/v1/users/:id` | Admin deletes a user |
| GET | `/api/v1/users/:id/supervisees` | Lecturer gets their assigned students |

### Settings & Audit (new for v1.0)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/settings` | Get system settings |
| PATCH | `/api/v1/settings` | Admin updates settings |
| GET | `/api/v1/audit-log` | Admin retrieves audit log |
| GET | `/api/v1/sessions` | Get academic sessions |
| POST | `/api/v1/sessions/migrate` | Admin runs end-of-session migration |

---

## v2.0 Placeholder Route Behaviour

For routes tagged v2.0 (L7, St5, A6), the route should exist and render a consistent placeholder component:

```
[System name]

Research Trends / Research Explorer / Reports

This feature will be available after the first approval session 
is complete and topic data has been collected.

[ Back to Dashboard ]
```

Do not return 404. Do not hide the nav item. Render a friendly placeholder so users know the feature is coming.

---

## Navigation Rules

1. **No role selector on login** — role comes from the safe user profile returned by login or `GET /api/v1/auth/me`; routing is silent
2. **No cross-role navigation** — a lecturer cannot navigate to `/student/*` routes and vice versa. Redirect to own dashboard silently.
3. **Protected routes** — all `/lecturer/*`, `/student/*`, `/admin/*` routes require cookie-backed auth. Unauthenticated users are redirected to `/login` with the intended route stored for post-login redirect.
4. **Profile lives in avatar dropdown** — not a nav item. Dropdown contains: Account Details, Change Password, Notification Preferences, Sign Out.
5. **Active nav highlighting** — the current route's nav item is highlighted in primary green. L3 keeps L2 ("Pending Reviews") highlighted since it is a drill-in from L2.
6. **Back navigation on L3** — "← Back to Pending Reviews" breadcrumb preserves the filter state and scroll position of L2. Do not use browser back button behaviour — implement explicit state preservation.

---

*Source: `Navigation-Structure.md`, all screen breakdown files*
