# 07 — Data Model and API Needs

> **Source:** `Phase-3A-System-Architecture-Backend-Design.md`, `Database-Design-and-Schema.md`, `API-Design-and-Specifications.md`, all screen breakdown files
> **Database:** PostgreSQL + pgvector (Neon)
> **ORM:** Prisma

---

## Database Tables

### Existing (MVP — do not modify structure, only extend)

---

#### `historical_topics`
The core Tier 1 database — the permanent record of all approved past topics.

```sql
CREATE TABLE historical_topics (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  year        INTEGER,
  category    VARCHAR(100),
  supervisor  VARCHAR(200),
  embedding   vector(384),        -- SBERT pre-computed embedding
  source      VARCHAR(50),        -- 'import' | 'migrated' | 'manual'
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
```

---

#### `current_session_topics`
Tier 2 — topics approved in the current academic session (resets each year via migration).

```sql
CREATE TABLE current_session_topics (
  id              SERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  category        VARCHAR(100),
  supervisor_id   INTEGER REFERENCES users(id),
  student_id      INTEGER REFERENCES users(id),
  embedding       vector(384),
  approved_at     TIMESTAMP,
  session_id      INTEGER REFERENCES academic_sessions(id),
  created_at      TIMESTAMP DEFAULT NOW()
);
```

---

#### `under_review_topics`
Tier 3 — topics currently being reviewed (concurrent review detection).

```sql
CREATE TABLE under_review_topics (
  id              SERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  embedding       vector(384),
  reviewer_id     INTEGER REFERENCES users(id),
  submission_id   INTEGER REFERENCES submissions(id),
  started_at      TIMESTAMP DEFAULT NOW(),
  completed_at    TIMESTAMP
);
```

---

### New Tables (v1.0 additions)

---

#### `users`
All system users across all three roles.

```sql
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  email           VARCHAR(200) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('student', 'lecturer', 'admin')),
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  invite_token    TEXT,
  reset_token     TEXT,
  reset_token_exp TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

#### `supervisor_assignments`
Links students to their assigned supervisor lecturers.

```sql
CREATE TABLE supervisor_assignments (
  id            SERIAL PRIMARY KEY,
  student_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  lecturer_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_id    INTEGER REFERENCES academic_sessions(id),
  is_primary    BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE (student_id, lecturer_id, session_id)
);
```

---

#### `submissions`
A student's formal topic submission (one per student per session, or multiple if revised).

```sql
CREATE TABLE submissions (
  id              SERIAL PRIMARY KEY,
  student_id      INTEGER REFERENCES users(id),
  supervisor_id   INTEGER REFERENCES users(id),
  session_id      INTEGER REFERENCES academic_sessions(id),
  title           TEXT NOT NULL,
  category        VARCHAR(100),
  keywords        TEXT[],
  status          VARCHAR(30) DEFAULT 'pending_review'
                  CHECK (status IN ('pending_review', 'under_review', 'approved',
                                    'rejected', 'awaiting_revision')),
  parent_id       INTEGER REFERENCES submissions(id),  -- for revision threads
  is_draft        BOOLEAN DEFAULT false,
  submitted_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

#### `similarity_results`
Frozen snapshot of the similarity check result at time of submission — for audit and history.

```sql
CREATE TABLE similarity_results (
  id              SERIAL PRIMARY KEY,
  submission_id   INTEGER REFERENCES submissions(id),
  jaccard_score   FLOAT,
  tfidf_score     FLOAT,
  sbert_score     FLOAT,
  combined_score  FLOAT,
  risk_level      VARCHAR(10) CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  top_matches     JSONB,           -- array of top 5 match objects
  sbert_available BOOLEAN DEFAULT true,
  checked_at      TIMESTAMP DEFAULT NOW()
);
```

---

#### `decisions`
A lecturer's approval decision on a submission.

```sql
CREATE TABLE decisions (
  id              SERIAL PRIMARY KEY,
  submission_id   INTEGER REFERENCES submissions(id),
  lecturer_id     INTEGER REFERENCES users(id),
  outcome         VARCHAR(30) NOT NULL
                  CHECK (outcome IN ('approved', 'rejected', 'changes_requested')),
  reason          VARCHAR(200),    -- from dropdown on reject
  notes           TEXT,            -- optional freetext
  guidance        TEXT,            -- required on changes_requested
  decided_at      TIMESTAMP DEFAULT NOW()
);
```

---

#### `notifications`
Email notification queue and delivery log.

```sql
CREATE TABLE notifications (
  id              SERIAL PRIMARY KEY,
  recipient_id    INTEGER REFERENCES users(id),
  type            VARCHAR(50) NOT NULL,
                  -- 'submission_confirmed' | 'approved' | 'rejected'
                  -- | 'changes_requested' | 'account_created'
  submission_id   INTEGER REFERENCES submissions(id),
  email_to        VARCHAR(200),
  subject         TEXT,
  body            TEXT,
  sent_at         TIMESTAMP,
  status          VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed')),
  created_at      TIMESTAMP DEFAULT NOW()
);
```

---

#### `audit_log`
Immutable record of every significant system event.

```sql
CREATE TABLE audit_log (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id),
  event_type      VARCHAR(50) NOT NULL,
                  -- 'login' | 'logout' | 'topic_decision' | 'threshold_change'
                  -- | 'data_import' | 'user_added' | 'user_suspended'
                  -- | 'user_deleted' | 'settings_change' | 'session_migration'
  entity_type     VARCHAR(50),     -- 'submission' | 'user' | 'setting' | 'import'
  entity_id       INTEGER,
  detail          JSONB,           -- event-specific data (before/after values etc.)
  ip_address      VARCHAR(50),
  user_agent      TEXT,
  occurred_at     TIMESTAMP DEFAULT NOW()
);
```

---

#### `academic_sessions`
Academic year/session configuration.

```sql
CREATE TABLE academic_sessions (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,  -- e.g. "2025/2026"
  start_date      DATE,
  end_date        DATE,
  is_current      BOOLEAN DEFAULT false,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

---

#### `categories`
The 8 Public Health discipline categories (configurable by admin).

```sql
CREATE TABLE categories (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL UNIQUE,
  sort_order      INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

---

#### `system_settings`
Key-value store for configurable system parameters.

```sql
CREATE TABLE system_settings (
  key             VARCHAR(100) PRIMARY KEY,
  value           TEXT NOT NULL,
  updated_by      INTEGER REFERENCES users(id),
  updated_at      TIMESTAMP DEFAULT NOW()
);
-- Default rows:
-- ('threshold_low', '0.30')
-- ('threshold_high', '0.60')
-- ('email_template_submission_confirmed', '...')
-- ('email_template_approved', '...')
-- ('email_template_rejected', '...')
-- ('email_template_changes_requested', '...')
```

---

## Key Data Relationships

```
users (role=student) ─────────────────────────────┐
                                                   ↓
users (role=lecturer) ──── supervisor_assignments ──► submissions
         │                                              │
         │                                              ├── similarity_results
         │                                              │
         └──────────────────────────────────────────► decisions
                                                        │
                                                      notifications
                                                        
all users ──────────────────────────────────────────► audit_log

submissions ──────────────────────────────────────── current_session_topics
                                                      historical_topics (after migration)
```

---

## Required API Routes

### Authentication
```
POST   /api/v1/auth/login              Body: {email, password} → {token, role, user}
POST   /api/v1/auth/logout             Header: Bearer token
POST   /api/v1/auth/forgot-password    Body: {email}
POST   /api/v1/auth/reset-password     Body: {token, newPassword}
GET    /api/v1/auth/me                 → current user profile
```

### Similarity Engine (MVP — preserve exactly)
```
POST   /api/v1/check-similarity        Body: {topic, category?} → full result
POST   /embed                          Internal SBERT service
GET    /api/v1/health                  → {status, services}
```

### Submissions
```
GET    /api/v1/submissions             Query: {status, supervisorId, sessionId, studentId}
POST   /api/v1/submissions             Body: {title, category, supervisorId, keywords}
GET    /api/v1/submissions/:id         → submission detail + latest similarity result
POST   /api/v1/submissions/:id/draft   Save draft
PATCH  /api/v1/submissions/:id         Update draft before submission
POST   /api/v1/submissions/:id/submit  Finalise submission (triggers pre-check)
POST   /api/v1/submissions/:id/decision Body: {outcome, reason?, notes?, guidance?}
```

### Topics (Historical Repository)
```
GET    /api/v1/topics                  Query: {year, category, source, status, q}
POST   /api/v1/topics                  Admin: manual entry
PUT    /api/v1/topics/:id              Admin: edit
DELETE /api/v1/topics/:id              Admin: delete / archive
POST   /api/v1/topics/import           Admin: bulk import (multipart/form-data)
GET    /api/v1/topics/duplicates       Admin: run duplicate scan
POST   /api/v1/topics/resolve-duplicate Body: {pairId, action}
POST   /api/v1/topics/migrate-session  Admin: end-of-session migration
```

### Users
```
GET    /api/v1/users                   Admin: list all users, query: {role, status}
POST   /api/v1/users                   Admin: create user + send invite
GET    /api/v1/users/:id               Admin: get user detail
PATCH  /api/v1/users/:id               Admin: edit role or status
DELETE /api/v1/users/:id               Admin: delete user
GET    /api/v1/users/:id/supervisees   Lecturer: get assigned students + statuses
```

### Settings & Configuration
```
GET    /api/v1/settings                → all settings as key-value
PATCH  /api/v1/settings                Admin: update one or more settings
POST   /api/v1/settings/test-email     Admin: send test notification email
GET    /api/v1/categories              → all active categories
PATCH  /api/v1/categories              Admin: add/rename/reorder
GET    /api/v1/sessions                → all academic sessions
POST   /api/v1/sessions                Admin: create new session
PATCH  /api/v1/sessions/:id            Admin: update session
POST   /api/v1/sessions/:id/set-current Admin: set as current session
```

### Audit Log
```
GET    /api/v1/audit-log               Admin: query: {dateFrom, dateTo, eventType, userId}
GET    /api/v1/audit-log/export        Admin: CSV export
```

### Notifications
```
GET    /api/v1/notifications           User: their own notifications
PATCH  /api/v1/notifications/:id/read  Mark as read
```

---

## JSONB Structure for `similarity_results.top_matches`

```json
[
  {
    "rank": 1,
    "topicId": 42,
    "title": "Malaria prevalence in pediatric populations in Osun State",
    "year": 2021,
    "supervisor": "Dr. Musa",
    "category": "Epidemiology",
    "tier": 1,
    "scores": {
      "jaccard": 0.71,
      "tfidf": 0.79,
      "sbert": 0.88
    },
    "combinedScore": 0.88,
    "matchedKeywords": ["malaria", "prevalence", "children", "Osun"]
  }
]
```

---

*Source: `Database-Design-and-Schema.md`, `API-Design-and-Specifications.md`, all screen breakdown files*
