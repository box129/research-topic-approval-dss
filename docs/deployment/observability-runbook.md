# Production Observability Runbook

Operational logging and readiness contract for the Research Topic Approval DSS
backend (single Node/Express process in front of PostgreSQL, the Voyage HTTPS
provider, and SMTP).

## Logs

- In production (`NODE_ENV=production`) the backend emits **structured JSON,
  one object per line, to stdout/stderr only**. The hosting platform's log
  collector is the persistence and retention layer; the process neither
  requires nor maintains local log files, and no `logs/` directory exists in
  production. (Development keeps human-readable console output plus local
  `logs/error.log` / `logs/combined.log` convenience copies.)
- Retention is whatever the hosting platform provides. No specific provider
  retention guarantee is claimed here; verify retention during hosted-staging
  acceptance before relying on it for incident review.
- Log-level order is `error < warn < info < http < debug`. `LOG_LEVEL`
  (default `info`) selects the most verbose level emitted:
  - `error` — failures only;
  - `warn` — adds degraded/abnormal states (e.g., partial resident corpus,
    abandoned requests);
  - `info` — adds operational state changes (startup, shutdown, recoveries);
    this is the production default;
  - `http` — adds one completion line per request (`Request completed`,
    `Request failed`, `Request abandoned…`); **off by default** so routine
    traffic does not flood the collector;
  - `debug` — development diagnostics.
- During incident investigation, `LOG_LEVEL=http` may be enabled temporarily
  to see per-request completion lines (status, duration, requestId, userId,
  ip). Return it to `info` afterwards.
- Every request carries a correlation ID: the `X-Request-Id` response header
  matches the `requestId` field in the request's log lines and in any error
  logged for it. A user-reported failure plus its `X-Request-Id` finds the
  exact backend event chain.
- **Never log secrets or bulk personal data for diagnosis**: no passwords or
  placeholders, no activation/invitation/reset tokens, no token-bearing URLs,
  no JWT/session values, no Authorization/Cookie headers, no SMTP/Voyage/
  database credentials, no request bodies, and no complete departmental
  records. The logger redacts credential-shaped metadata keys as a backstop,
  but that protection is structural: pass context as metadata fields — never
  interpolate secret values into message strings or bury them under unrelated
  keys.

## Liveness vs readiness

- `GET /health` and `GET /api/v1/health` are **liveness only**: the process is
  up and responding. They make no claims about the database, Voyage, email,
  or the corpus.
- `GET /api/v1/readiness` is the dependency/core-service readiness check. Its
  `checks` block reports, per component:
  - `database` — a bounded (2s) connectivity probe; unavailable ⇒ overall
    `not_ready` (HTTP 503). Loss and recovery are also logged once per
    transition.
  - `semanticProvider` — the Voyage verification state (bounded probe with a
    documented cache/grace policy); not available ⇒ overall `degraded`
    (HTTP 503). No fallback scoring exists.
  - `residentCorpus` — the in-process comparison corpus:
    - **never built** (no active snapshot) ⇒ overall `not_ready` (HTTP 503):
      similarity checks cannot run at all;
    - **active but a later refresh failed** ⇒ component `degraded`, overall
      stays `ready`: the previous valid snapshot is intentionally preserved
      and continues to serve checks — investigate `refreshFailed: true`
      alongside the `Resident corpus refresh failed` log line, but do not
      restart merely to clear it;
    - **active with skipped rows** — `skippedInvalidEmbeddingCount > 0` means
      stored rows whose embeddings fail the validity contract are excluded
      from search. This is informational in readiness (a `Resident corpus
      snapshot is partial…` warning is logged once per change); whether any
      skipped rows should ever fail readiness is a separately-tracked product
      decision.
  - `emailDelivery` — informational SMTP capability (`configured` = EMAIL
    READY); it never gates readiness, but first-admin bootstrap refuses
    without it.
- Readiness payloads contain counts, timestamps, statuses, and fixed
  messages — never raw error text, stack traces, topic content, vectors, or
  personal identifiers.

## Quick triage

| Signal | Meaning | First action |
| --- | --- | --- |
| readiness 503, `database: unavailable` | PostgreSQL unreachable/timing out | check database service/network; watch for `Database connectivity recovered` |
| readiness 503, `semanticProvider` not available | Voyage unverified/failed | check Voyage status/key validity; no fallback exists by design |
| readiness 503, `residentCorpus: unavailable` | corpus never built since boot | check `Resident corpus refresh failed` log lines; verify DB rows/embeddings |
| ready, `residentCorpus: degraded` | serving preserved snapshot; refresh failing | investigate refresh failures; data stays truthful meanwhile |
| `skippedInvalidEmbeddingCount > 0` | partial corpus; some rows excluded | inspect stored embeddings (admin system status shows the same counts) |
| `Fatal uncaught failure` then exit | process crashed by policy | read the logged stack; the process must be restarted by the supervisor |
