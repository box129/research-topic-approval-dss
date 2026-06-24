# Email and Notification Foundation

## Purpose

PR #104 created a safe communication foundation without committing credentials, sending real emails in tests, or inventing notification data. PR #109 adds real SMTP transport support while preserving mock and disabled modes.

## Email Modes

The backend email service supports explicit provider modes through `EMAIL_PROVIDER`.

| Mode | Behavior | Production use |
| --- | --- | --- |
| `mock` | Accepts password reset email requests without external delivery. Used by default outside production. | Rejected in production. |
| `disabled` | Fails closed with a clear email-provider error. | Allowed when delivery is intentionally unavailable. |
| `smtp` | Sends password reset email through the configured SMTP transport. Tests use injected transports and do not require network delivery. | Operational when real provider credentials are configured and smoke-tested by the deployment owner. |

Production requires `EMAIL_PROVIDER` to be set explicitly. Production also rejects `EMAIL_PROVIDER=mock`.

When `EMAIL_PROVIDER=smtp`, these variables are required:

```text
SMTP_HOST
SMTP_PORT
EMAIL_FROM
```

Optional SMTP settings:

```text
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
SMTP_TIMEOUT_MS
```

`SMTP_PORT` must be a valid TCP port. `SMTP_SECURE` must be `true` or `false`. If SMTP authentication is used, `SMTP_USER` and `SMTP_PASSWORD` must be provided together.

Do not commit real SMTP credentials or API keys. Use environment secrets from the deployment platform or a local `.env` file that stays outside Git. Institutional SMTP or provider-specific app-password setup should be documented in the deployment runbook for the chosen environment; do not hardcode credentials in repository docs.

## Password Reset Safety

Forgot-password and reset-password behavior remains the existing token-link flow.

The database stores only `resetTokenHash` and expiry values. The email service receives the plaintext reset token only to build the reset link content, and service results/logs do not expose reset token hashes, password hashes, auth tokens, SMTP passwords, or API keys.

No real external email is sent in automated tests. SMTP provider smoke testing is manual and controlled.

## Manual SMTP Provider Smoke

PR #116 adds a one-message provider smoke script:

```powershell
npm run smoke:smtp
```

The script only runs when `EMAIL_PROVIDER=smtp`. It requires:

```text
EMAIL_PROVIDER=smtp
SMTP_HOST=<provider host>
SMTP_PORT=<provider port>
SMTP_SECURE=true|false
EMAIL_FROM=<verified sender>
SMTP_SMOKE_TO=<controlled test recipient>
```

If the provider requires authentication, also set both:

```text
SMTP_USER=<provider username>
SMTP_PASSWORD=<provider password or app password>
```

Optional:

```text
SMTP_TIMEOUT_MS=10000
```

The smoke sends one clearly labelled email with subject:

```text
[SMOKE] Research Topic Approval DSS SMTP provider verification
```

It prints only non-secret configuration metadata, accepted/rejected recipient counts, and a provider message id when returned. It must not print SMTP passwords, reset tokens, token hashes, password hashes, database data, or student records.

PowerShell example:

```powershell
$env:EMAIL_PROVIDER='smtp'
$env:SMTP_HOST='smtp.example.edu'
$env:SMTP_PORT='587'
$env:SMTP_SECURE='false'
$env:EMAIL_FROM='no-reply@example.edu'
$env:SMTP_USER='deployment-owned-user'
$env:SMTP_PASSWORD='deployment-owned-secret'
$env:SMTP_SMOKE_TO='controlled-recipient@example.edu'
npm run smoke:smtp
```

Bash example:

```bash
EMAIL_PROVIDER=smtp \
SMTP_HOST=smtp.example.edu \
SMTP_PORT=587 \
SMTP_SECURE=false \
EMAIL_FROM=no-reply@example.edu \
SMTP_USER=deployment-owned-user \
SMTP_PASSWORD=deployment-owned-secret \
SMTP_SMOKE_TO=controlled-recipient@example.edu \
npm run smoke:smtp
```

The script is never run by normal CI or the release gate. Do not claim provider-level delivery is verified unless this smoke succeeds against the chosen SMTP provider and the controlled recipient confirms receipt.

The existing password reset flow can also be tested manually after provider smoke succeeds:

1. Configure `EMAIL_PROVIDER=smtp` plus `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_FROM`, and any required `SMTP_USER`/`SMTP_PASSWORD` outside Git.
2. Start the backend in the target environment.
3. Trigger the existing forgot-password flow for a controlled test account and verify delivery with the intended recipient.
4. Confirm logs/results do not expose reset tokens, token hashes, password hashes, SMTP passwords, or provider secrets.

Do not claim provider-level delivery is verified until this smoke test is actually run against the chosen SMTP provider.

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
