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
  - `residentCorpus` — the in-process comparison corpus. Startup builds the
    first snapshot deliberately, and a failed initial build retries
    automatically (bounded timer) until it succeeds — a fresh process
    converges to ready on its own, with no user request required. States:
    - **`unavailable` (no active snapshot)** ⇒ overall `not_ready` (HTTP 503):
      similarity checks cannot run yet. On a fresh boot this is normal for the
      first moments (**initialization in progress**) and resolves itself once
      `Resident corpus initial snapshot built` appears in the logs. If it
      persists, the **initial build is failing and retrying**: look for
      `Resident corpus refresh failed` lines (logged once per distinct
      outage) and fix the underlying cause — the process keeps retrying and
      becomes ready without a restart. "Never built" does not by itself mean
      a refresh error occurred.
    - **`degraded` (active but a later refresh failed)** ⇒ overall stays
      `ready`: the previous valid snapshot is intentionally preserved and
      continues to serve checks — investigate `refreshFailed: true` alongside
      the `Resident corpus refresh failed` log line, but do not restart merely
      to clear it. A successfully built **empty** snapshot (zero eligible
      rows) is valid `available` state, not `unavailable`; checks then
      truthfully report that nothing exists to compare against.
    - **`partial` (active but missing currently-searchable rows)** ⇒ overall
      `not_ready` (HTTP 503): `skippedSearchEligibleEmbeddingCount > 0` means
      stored rows that SHOULD be searchable right now are excluded because
      their embeddings fail the validity contract. Every similarity check
      (student pre-check and lecturer review alike) then refuses with
      HTTP 503 and `error_code: CORPUS_INCOMPLETE` — no Voyage call, no
      scores, no LOW/MEDIUM/HIGH verdict — rather than rank against a corpus
      known to be missing rows, so readiness withdraws the instance until the
      corpus is repaired. Repair is operator-run, never automatic, and
      converges through a controlled restart:
      1. From a shell inside the backend container (the CLI ships in the
         production image, and that private environment already carries the
         required database and Voyage configuration — the managed database
         has no public ingress, so repair is not run from a workstation),
         execute `node /app/scripts/backfill-topic-embeddings.js`. It
         re-embeds only rows failing the validity contract and prints one
         JSON report: `{"completed":N,"skipped":N,"failed":N}`.
      2. Process exit alone is NOT proof of repair — the script tolerates
         per-row failures — so inspect the report and require `failed: 0`.
         If `failed > 0`: stop, do not declare recovery, and do not re-run
         the script in a blind loop against Voyage; investigate the
         operational cause (provider outage, credentials, malformed rows)
         first. Readiness and similarity stay fail-closed meanwhile.
      3. On `failed: 0`, perform a CONTROLLED RESTART of the backend
         service/container using the hosting platform's normal restart
         mechanism — a restart of the existing deployed service, not a
         source deployment and not a schema migration. The restart is
         required, not optional: the backfill CLI updates PostgreSQL in a
         separate process, while the serving process's resident corpus is an
         in-memory snapshot, so restart is what reconstructs the active
         snapshot deterministically. `stats()` and readiness polls never
         refresh the snapshot, waiting out the 5-second freshness window
         rebuilds nothing by itself, and recovery must not depend on a
         student or lecturer similarity request happening to arrive to
         trigger a rebuild.
      4. On restart, the startup initializer deliberately builds a fresh
         snapshot from the repaired database (retrying automatically if the
         first build fails). Wait for `Resident corpus initial snapshot
         built` in the logs, then verify readiness: `residentCorpus` must
         not be `partial` and `skippedSearchEligibleEmbeddingCount` must be
         0. Only then declare corpus recovery.
      Hosted-staging acceptance follows the same sequence after backfilling
      the embedding-less demo/seed records: backfill, `failed: 0`,
      controlled restart, startup rebuild, then verify
      `skippedSearchEligibleEmbeddingCount = 0` before the deployment is
      accepted.
    - **Total vs eligible skipped counts** — `skippedInvalidEmbeddingCount`
      is every excluded-invalid row; `skippedSearchEligibleEmbeddingCount` is
      only those that would be compared right now. An invalid under-review
      row already outside the 48-hour eligibility window would not be
      compared even if valid, so it stays in the total but not the eligible
      count and gates nothing — the total can sit above zero while the
      service is fully ready. (The `Resident corpus snapshot is partial…`
      warning is still logged once per change in the total.)
    - Count semantics: `sourceTopicCount` and `skippedInvalidEmbeddingCount`
      are frozen on the active snapshot; `searchableTopicCount` and
      `skippedSearchEligibleEmbeddingCount` are current-time derived because
      under-review rows age out of the 48-hour eligibility window without a
      rebuild — an expired gap stops gating on its own, with no restart and
      no rebuild, and the admitted-row count and the currently-searchable
      count are deliberately different numbers.
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
| readiness 503, `residentCorpus: unavailable`, boot just happened | initial snapshot still building | wait for `Resident corpus initial snapshot built`; no action needed |
| readiness 503, `residentCorpus: unavailable`, persisting | initial build failing; process is retrying automatically | fix the cause shown by `Resident corpus refresh failed`; readiness converges without a restart |
| ready, `residentCorpus: degraded` | serving preserved snapshot; refresh failing | investigate refresh failures; data stays truthful meanwhile |
| readiness 503, `residentCorpus: partial` | corpus missing rows that should be searchable; similarity checks refusing with `CORPUS_INCOMPLETE` | in the backend container run `node /app/scripts/backfill-topic-embeddings.js`; require `failed: 0` in its JSON report; controlled-restart the backend so startup rebuilds the corpus; verify `skippedSearchEligibleEmbeddingCount` returns to 0 |
| `skippedInvalidEmbeddingCount > 0` with `skippedSearchEligibleEmbeddingCount: 0` | only expired under-review gaps are excluded; nothing a check would compare is missing | no gate; the same backfill CLI clears the residue when convenient |
| `Fatal uncaught failure` then exit | process crashed by policy | read the logged stack; the process must be restarted by the supervisor |
