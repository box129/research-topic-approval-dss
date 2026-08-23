# Incident Playbooks

Concise operator runbooks for the common failure modes of the Research Topic
Approval DSS. Diagnosis vocabulary: request IDs (`X-Request-Id` header ↔ log
field `requestId`), error categories (`DATABASE`, `VOYAGE_PROVIDER`,
`SMTP_PROVIDER`, …), `/api/v1/readiness`, and the admin
`/api/v1/admin/system-status` endpoint. General rules: never edit production
SQL casually; never restore over production blindly; never paste secrets into
tickets.

---

## 1. Similarity checker unavailable

- **Symptom**: students/lecturers get "semantic analysis is currently
  unavailable"; submissions fail with the same message.
- **Evidence**: readiness → `semanticProvider.status`; logs filtered by
  category `VOYAGE_PROVIDER` or `CORPUS`; system-status → residentCorpus
  (`lastRefreshError`) and provider failure code; the user's request ID.
- **Action**: if provider `unavailable` → Playbook 2. If corpus
  `lastRefreshError` set → database problem, Playbook 3. If provider
  `available` and corpus healthy but one request failed → search its request
  ID for the specific error.
- **Escalate** when Voyage is up, DB is up, and failures persist —
  application-level defect; collect request IDs and involve the maintainer.

## 2. Voyage outage

- **Symptom**: readiness `degraded`; log line `Voyage provider status
  changed … to: unavailable` with a failure code; similarity requests 5xx
  with category `VOYAGE_PROVIDER`.
- **Evidence**: failure code (`VOYAGE_…`), `lastFailedAt`, Voyage status page
  / dashboard, whether the API key was recently rotated.
- **Action**: nothing in-app can "fix" a provider outage — the system
  correctly refuses to fabricate similarity. If the failure code indicates
  auth (invalid key), rotate/fix `VOYAGE_API_KEY` per the rotation runbook
  and restart. Otherwise wait; the probe recovers automatically (state-change
  log `to: available`) within one cache window of Voyage recovery.
- **Escalate**: sustained outage during a submission deadline → inform the
  department; consider communicating a deadline extension. Never bypass the
  semantic gate.

## 3. Database unavailable

- **Symptom**: readiness `not_ready` (`database: unavailable`); log line
  `Database connectivity lost`; widespread 5xx with category `DATABASE`.
- **Evidence**: provider DB dashboard (CPU/storage/connections),
  `DATABASE_URL` secret unchanged?, network/allow-list changes, storage full.
- **Action**: restore provider service (restart instance, raise storage,
  fix allow-list). The app needs no intervention: readiness logs
  `Database connectivity recovered` and admits traffic again. If data
  corruption is suspected → stop writes and go to Playbook 10.
- **Escalate**: any suspicion of data loss/corruption → Playbook 10
  immediately; do not keep serving writes.

## 4. Email invitations not arriving

- **Symptom**: admin sends invitations; recipients receive nothing.
- **Evidence**: the admin UI/API reports per-user truthful delivery
  (`sent`/`failed` + reason code); user row `invitation.lastError`
  (`smtp-auth-failed`, `smtp-connect-failed`, `smtp-recipient-rejected`,
  `smtp-timeout`); logs category `SMTP_PROVIDER`; system-status
  emailDelivery state; audit `USER_INVITATION_DELIVERY_FAILED`.
- **Action**: `provider-disabled` → email is deliberately off
  (EMAIL CAPABILITY DISABLED); enable SMTP configuration when approved.
  `smtp-auth-failed` → rotate/fix SMTP credentials. `connect/timeout` →
  provider/network outage; retry later with Resend (a resend invalidates the
  old link safely). `recipient-rejected` → verify the address via identity
  correction. If email stays down, the manual temporary-credential /
  credential-manifest fallback remains fully operational.
- **Escalate**: delivery accepted (`sent`) but mail never arrives →
  provider-side investigation (spam/deliverability), outside the app.

## 5. Student cannot log in

- **Symptom**: a specific user reports login failure.
- **Evidence**: audit events for the email (`AUTH_LOGIN_FAILED` reason;
  account `suspended`?; `mustChangePassword` pending?); rate-limit 429s
  (category `RATE_LIMIT`); whether a recent credential reset/invitation
  changed state; the user's request ID if available.
- **Action**: wrong password → user waits out the limiter window (minutes)
  and retries or uses forgot-password (needs email capability). Suspended →
  reactivate via admin UI if appropriate (audited). Awaiting first password →
  resend invitation or issue a fresh temporary credential (admin
  credential-reset, shown once). Never read or set passwords manually.
- **Escalate**: many users failing at once → check readiness (DB), JWT_SECRET
  rotation side-effects (expected global sign-out), or clock skew.

## 6. Bulk import failed

- **Symptom**: user-import or topic-import preview/commit errors.
- **Evidence**: the API's own report (row-level statuses, error codes such as
  `MALFORMED_WORKBOOK`, `IMPORT_TOO_MANY_ROWS`, `BULK_IMPORT_STATE_CHANGED`,
  `SEMANTIC_PROVIDER_UNAVAILABLE`); audit `*_IMPORT_*` events; logs category
  `IMPORT`; request ID from the admin's session.
- **Action**: file-shape errors → fix the spreadsheet (template download
  exists). `BULK_IMPORT_STATE_CHANGED` → directory changed mid-flight;
  re-preview and commit again (idempotent, no partial cohort persists).
  Topic-import commit blocked by Voyage → Playbook 2, then retry; nothing was
  half-persisted (atomic contract).
- **Escalate**: commit reported success but data looks wrong → do NOT re-run
  blindly; verify with counts + audit batch metadata first (replay of the
  same file is safe/no-op by design for user import; topic import replays
  are fingerprint-deduplicated).

## 7. Suspected credential / API-key exposure

- **Symptom**: a secret (JWT, Voyage key, SMTP password, DB URL, admin
  password) may have leaked (repo, logs, screenshot, phishing).
- **Evidence**: what leaked, where, when; audit trail for unexpected admin
  actions; provider usage dashboards (Voyage spend spikes); abnormal login
  patterns.
- **Action**: rotate the affected secret immediately per
  `secrets-management.md` rotation runbook (JWT rotation = global sign-out —
  acceptable during an incident). For suspected account compromise: suspend
  the account, admin credential-reset, review audit history. Preserve
  evidence before cleanup.
- **Escalate**: any confirmed exposure of departmental personal data →
  departmental/institutional reporting path; this exceeds operator scope.

## 8. Application restart / crash loop

- **Symptom**: platform restarts the backend repeatedly.
- **Evidence**: `Fatal uncaught failure` log entries (kind, safe
  message/stack) just before each exit; startup lines with version/buildId;
  whether crashes started after a deploy or a config change.
- **Action**: crash on startup with validation messages → fix the named
  environment variable (validation errors are explicit). Fatal events after
  a deploy → roll back the application image (application rollback is safe
  and independent of the database; see backup runbook). Fatal events under
  specific traffic → capture the preceding request IDs and reproduce in
  staging.
- **Escalate**: crash loop with no fatal log and no config change →
  platform/runtime issue; involve hosting support with timestamps.

## 9. Accidental topic-import replay

- **Symptom**: an operator re-committed a historical topic spreadsheet and
  fears duplicates.
- **Evidence**: audit `TOPIC_IMPORT_COMMITTED` metadata (batch id, inserted
  vs duplicate counts); persistence report returned at commit time; topic
  counts by `import_batch_id`.
- **Action**: usually no action — source-fingerprint deduplication makes an
  exact replay skip existing records (`duplicate_records` in the report).
  Verify via the report/audit rather than assuming damage. If a *modified*
  file introduced unwanted near-duplicate rows, identify them by
  `import_batch_id` and remove through the maintainer path (not ad-hoc SQL).
- **Escalate**: corpus counts look wrong after verification → maintainer
  review before any deletion; embeddings/corpus rebuild automatically after
  corrections.

## 10. Restore from backup

Follow the emergency restore runbook in
[backup-and-restore-runbook.md](./backup-and-restore-runbook.md) step by
step: identify → stop writes → select backup → restore to isolated DB →
verify integrity → switch connection → readiness/smoke → re-enable →
record. Key rules: never restore over production blindly; prefer rotating
`JWT_SECRET` afterwards; re-issue outstanding invitations; document the
data-loss window.
