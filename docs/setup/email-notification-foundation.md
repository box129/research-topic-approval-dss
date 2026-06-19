# Email and Notification Foundation

## Purpose

PR #104 creates a safe communication foundation without committing credentials, sending real emails in tests, or inventing notification data.

## Email Modes

The backend email service supports explicit provider modes through `EMAIL_PROVIDER`.

| Mode | Behavior | Production use |
| --- | --- | --- |
| `mock` | Accepts password reset email requests without external delivery. Used by default outside production. | Rejected in production. |
| `disabled` | Fails closed with a clear email-provider error. | Allowed when delivery is intentionally unavailable. |
| `smtp` | Validates SMTP env configuration but does not send email yet. SMTP transport integration is deferred because no mail dependency is installed. | Not operational until a scoped SMTP/provider implementation is added. |

Production requires `EMAIL_PROVIDER` to be set explicitly. Production also rejects `EMAIL_PROVIDER=mock`.

When `EMAIL_PROVIDER=smtp`, these variables are required:

```text
SMTP_HOST
SMTP_PORT
EMAIL_FROM
```

Optional SMTP placeholders:

```text
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
```

Do not commit real SMTP credentials or API keys.

## Password Reset Safety

Forgot-password and reset-password behavior remains the existing token-link flow.

The database stores only `resetTokenHash` and expiry values. The email service receives the plaintext reset token only to build the reset link content, and service results/logs do not expose reset token hashes, password hashes, auth tokens, SMTP passwords, or API keys.

No real external email is sent in development or tests.

## Notification Foundation

PR #104 adds a real `Notification` Prisma model and authenticated user endpoints:

```text
GET /api/v1/notifications
PATCH /api/v1/notifications/:id/read
PATCH /api/v1/notifications/read-all
```

Rules:

- Every notification belongs to a real `User`.
- Users can list and mark only their own notifications.
- No public notification endpoints exist.
- Admins do not receive blanket notification access through these endpoints.
- Empty lists return `items: []` with pagination metadata.
- Sensitive metadata keys such as password hashes, reset token hashes, auth tokens, API keys, and secrets are redacted.

## Event Hooks

PR #104 does not create notification event hooks. Student submission created, lecturer decision/status changed, password reset requested, and admin broadcast hooks remain deferred until each event contract is reviewed and tested.

No fake notification feed, fake email history, frontend notification center, marketing email, report export emailing, or user preference UI is introduced.
