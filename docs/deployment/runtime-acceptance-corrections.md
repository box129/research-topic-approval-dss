# Runtime Acceptance Corrections

> **Status: two operational risks from container acceptance investigated,
> corrected where an application defect existed, and precisely bounded where the
> limit is environmental.** Synthetic data only. This is not hosted-staging
> evidence and does not approve real Public Health data.

Container acceptance passed all 28 items but exposed two risks:

1. a 650-user bulk onboarding commit took **388.6 s** in the production container
   environment against roughly **141.9 s** in the earlier host-process rehearsal;
2. Voyage readiness briefly returned `stale`/503 at a routine probe-cache
   expiry boundary before the asynchronous refresh restored `ready`.

## Measurement conditions

Every measurement below was taken on the same host, which matters for reading
them honestly:

| Item | Value |
| --- | --- |
| CPU | Intel Core i5-10310U — **4 physical cores / 8 logical threads**, 15 W ultra-low-voltage laptop part |
| Rated clock | 1.70 GHz base, 2.208 GHz max |
| **Observed clock under sustained load** | **802 MHz — about 36% of maximum** |
| Observed load | 100% |
| Thermal management | Intel DPTF (`dptf_helper`) active |
| Windows power scheme | **Balanced** (not High Performance) |
| Container CPU view | 8 logical processors, **4 physical cores**, cgroup `cpu.max = max` (no quota) |
| bcrypt | `bcryptjs` 3.0.3, **pure JavaScript**, cost **12** (unchanged) |

The host is persistently thermally/power throttled under sustained multi-core
load, and stayed at 802 MHz even after a 90-second idle settle. Treat every
absolute duration here as a **slow-hardware lower bound**, and the relative
comparisons — which were taken back-to-back under identical conditions — as the
trustworthy signal.

## Issue A — bulk onboarding runtime

### Where the time actually goes

The service already exposes `timing: { hash_ms, transaction_ms }` on the commit
response and repeats both in the batch audit record, so no new instrumentation
was needed. Measured through the full container request path:

| Phase | Share of a 100-user commit |
| --- | --- |
| bcrypt hashing | **95.8%** |
| Database transaction | 0.4% |
| Everything else (workbook parse, classification, manifest, response) | 3.7% |

Bulk onboarding is almost entirely bcrypt. Workbook parsing, classification and
the credential manifest are negligible, and the directory comparison is already
batched into two `IN` queries rather than per-row lookups.

### Root cause

Two separate factors, and only one of them is an application defect.

**1. Host CPU state — the dominant factor.** The container host is a 15 W
ultra-low-voltage laptop CPU running at 802 MHz, roughly 36% of its rated
maximum, under sustained load. The same 100-user commit measured **24.4 s**
during container acceptance and **114.3 s** during this investigation on the same
container and the same code — a 4.7× spread driven purely by machine thermal
state. A single bcrypt cost-12 hash on one worker thread measured **2,244 ms**
here; on unthrottled modern hardware pure-JS bcryptjs at cost 12 is several times
faster. **This, not containerisation, explains most of the 388.6 s versus 141.9 s
difference**, and it is why the earlier host-process rehearsal on a cooler
machine looked so much better.

**2. Worker-pool oversubscription — a genuine, fixable defect.** The pool was
sized from `os.cpus().length`, which reports **logical** processors. On this
4-core/8-thread host that produced `min(8 - 2, 6) = 6` workers for a workload
that gains nothing from hyperthreading. Measured back-to-back at n=48, identical
conditions:

| Worker pool | Throughput (hashes/s) | Versus best |
| --- | --- | --- |
| 1 | 0.22 | −84% |
| 2 | 0.57 | −59% |
| 3 | 1.00 | −28% |
| **4 (= physical cores)** | **1.39** | **best** |
| 6 (previous default) | 1.06 | **−24%** |
| 8 | 0.97 | **−30%** |

Throughput peaks at one worker per **physical** core and degrades on both sides.
The previous default sat past the peak, losing about a quarter of throughput.

### Change made

`resolvePoolSize` now derives its default from real capacity instead of logical
processor count:

- one worker per **physical core**, counted from distinct `physical id`/`core id`
  pairs in `/proc/cpuinfo`;
- never more than the container's **cgroup CPU quota** (v2 `cpu.max`, falling back
  to v1 `cpu.cfs_quota_us`/`cpu.cfs_period_us`). A fractional allowance such as
  0.5 CPU still means one worker, never the host's core count. This matters more
  on a hosted platform than locally: the CPU topology describes the *host*, so
  without the quota check a small hosted container would start one worker per
  host core and thrash;
- when topology is unavailable, assume the common hyperthreaded ratio
  (half of logical) rather than treating every thread as a core;
- still bounded to 1–8, and `BULK_HASH_CONCURRENCY` remains authoritative for a
  deployment that has measured its own target host.

**bcrypt cost 12 is unchanged.** Generated credentials, batch atomicity, replay
semantics and manifest security are untouched — only how many workers compute the
hashes concurrently.

### Measured effect of the change

Same host, same day, same throttled conditions, 100-user commit through the full
container request path:

| Worker pool | Hashing | Throughput | Backend CPU | Backend memory |
| --- | --- | --- | --- | --- |
| 6 (previous default) | 109.5 s | 0.91 hashes/s | 628–676% | 118–139 MiB |
| **4 (corrected default)** | **45.8 s** | **2.19 hashes/s** | **416–527%** | **76–77 MiB** |

The corrected pool does **more work using less CPU and less memory** — the
signature of removing oversubscription rather than of buying throughput.

Final 650-user measurement on the corrected default:

| Measure | Value |
| --- | --- |
| Accounts created | **650**, one atomic batch |
| bcrypt hashing | **305,679 ms (305.7 s)** — from the batch audit record |
| Database transaction | **1,817 ms (1.8 s)** |
| Everything else | ~16 s (parse, classification, manifest, per-user audit writes) |
| **Backend total** | **≈ 324 s** |
| Worker count | **4** (one per physical core) |
| Throughput | **2.13 hashes/s** (2.19 at n=100 — essentially flat) |
| bcrypt cost | **12, unchanged** |
| Peak backend CPU / memory | ~527% / ~77 MiB |
| PostgreSQL memory | ~48 MiB |

Throughput is effectively identical at 100 and 650 users, so bulk onboarding
scales **linearly**. The superlinear appearance during container acceptance
(244 ms/user at 100 versus 598 ms/user at 650) was thermal drift across a long
run, not an algorithmic problem.

## A4 — required hosted request budget

Three different numbers, deliberately kept separate:

**1. Application observed duration.** ~**324 s** for 650 users on the measured
host, of which ~94% is bcrypt. Worst duration observed across both phases was
**388.6 s** (before the worker-sizing fix). This is a property of CPU capability,
not of the code path.

**2. Nginx inactivity timeout (ours, configurable).** `proxy_read_timeout 300s`
in `frontend/nginx.conf` and in the acceptance edge. Nominally this is an
inactivity timeout between successive reads from the upstream — but for this
endpoint it behaves as a **hard total deadline**, because the backend streams
nothing at all until the operation completes. Proven directly:

```
[error] upstream timed out (110: Operation timed out)
        while reading response header from upstream
POST /api/v1/admin/users/import/commit  504
```

fired at exactly 300 s. There is no keep-alive traffic to reset the timer, so
"inactivity timeout" and "total deadline" are the same number here.

**3. Hosting provider hard request limit (theirs, usually not configurable).**
A platform-level cap on total request duration regardless of activity. This is
independent of item 2 and cannot be raised by editing our Nginx configuration.

### The requirement

> **Bulk departmental onboarding requires a request path — every hop, including
> the hosting platform's own hard limit — capable of at least 600 seconds.**

600 s is roughly 1.85× the corrected observation (324 s) and 1.55× the worst
duration observed on the slowest hardware measured (388.6 s). The margin is
deliberate: hashing throughput varies with host clock and thermal state by a
factor of several on the same machine, so a budget close to the observation would
fail intermittently rather than never.

A platform that caps requests below this can only be accepted if it is measured
to be fast enough. Concretely, to finish 650 users inside a 300-second cap with
usable margin, the host must sustain **≥ 3.25 bcrypt cost-12 hashes/second**
(650 hashes in ≤ 200 s). The measured host sustains 2.13. Measure the candidate
host and set the budget from its own figure with at least a 1.5× margin — do not
assume either the 142 s or the 324 s figure transfers.

**Phase 8B must reject any hosting platform or topology whose hard request limit
is below the proven requirement.** This is a rejection criterion, not a
preference: as recorded below, exceeding the budget strands a committed cohort's
credentials rather than simply returning an error.

### What was deliberately not done

No background-job architecture was introduced. The operation is a single atomic
administrative request today, its cohort consistency is a Phase-3 guarantee, and
converting it to asynchronous processing to satisfy a timeout would require
persisting plaintext credential manifests — which is exactly what the design
avoids. The correct resolution is an adequate request budget, not weaker
credential handling.

## Issue B — readiness cache-boundary flap

### Root cause

`getStatus()` is synchronous. When the probe cache expired it fired the
replacement probe with `void probe()` and **immediately returned `STALE`**, and
`readiness.service` maps any non-`available` provider to `degraded` + HTTP 503.
The probe itself normally completes in well under a second, so a completely
healthy provider produced exactly one 503 per cache window — the request(s)
landing between cache expiry and probe completion.

Observed during container acceptance, with a 300 s cache:

```
t+180s HTTP=200 ready    semantic=available
t+190s HTTP=503 degraded semantic=stale      <-- healthy provider, routine refresh
t+200s HTTP=200 ready    semantic=available
```

A hosted load balancer that withdraws an instance on a single failed readiness
probe would therefore flap roughly every five minutes.

### State machine after the fix

Bounded stale-while-revalidate. On cache expiry the replacement probe still
starts, but a provider whose **last verification succeeded** keeps reporting
`available` with a new `revalidating: true` marker while that probe runs:

| Condition | Reported status | Readiness |
| --- | --- | --- |
| Verified within the probe cache | `available`, `revalidating: false` | 200 ready |
| Cache expired, last verification **succeeded**, still within cache + grace, refresh in flight | `available`, **`revalidating: true`** | **200 ready** |
| Refresh **succeeds** | `available`, timestamps advanced | 200 ready |
| Refresh **fails** | `unavailable` with failure code | 503 degraded |
| Last success older than cache + grace | `stale` | 503 degraded |
| **Never verified** | `configured_not_yet_verified` | 503 degraded |
| Not configured | `not_configured` | 503 degraded |

The grace is deliberately finite and can never mask a real outage: a failed probe
ends it immediately, a provider that has never verified can never borrow it, and
last-known-good never survives beyond `probe cache + grace`.

### Configuration

`VOYAGE_READINESS_STALE_GRACE_MS` — integer, **1000–300000**, default **60000**,
validated at startup like every other bounded setting, documented in the
environment matrix and the Compose contract, and wired into
`.env.compose.example` and both Compose services that carry provider settings.
Maximum tolerated staleness is `VOYAGE_READINESS_PROBE_CACHE_MS + this`, i.e.
360 s at the defaults. There is no unbounded last-known-good mode.

### Probe cost and de-duplication

Probe de-duplication was already correct and is preserved: `probe()` returns the
in-flight promise, so many concurrent readiness requests at cache expiry share
exactly **one** paid Voyage probe. A regression test asserts that 25 concurrent
expired-cache reads produce exactly one additional provider call, and that every
one of them reports `available`/`revalidating`. Readiness never pays a probe per
request.

### Container rehearsal — readiness

Readiness polled every 10 s for 840 s against the production stack, crossing
**two full 300-second probe-cache boundaries**:

| | Container acceptance (before) | This phase (after) |
| --- | --- | --- |
| Samples | 56 over 560 s | 84 over 840 s |
| Ready / not ready | 48 / **8** | **83 / 1** |
| 503 caused by routine refresh | **one at every boundary** | **none** |
| The one remaining non-ready | — | `t+0s` `configured_not_yet_verified`, before any probe had completed |

The decisive before/after is the same moment in the cycle:

```
before:  t+180s 200 ready      t+190s 503 degraded stale     t+200s 200 ready
after:   t+280s 200 ready      t+290s 200 ready revalidating=true   t+300s 200 ready
```

The single remaining 503 is correct and required: at `t+0` the provider had never
been verified, and a never-verified provider must not claim ready.

### Container rehearsal — genuine outage still detected

Run inside the production image against the real database, with an invalid
synthetic credential and a deliberately short cache (10 s) and grace (5 s):

| Step | Result |
| --- | --- |
| Outage begins | HTTP **503** `degraded`, `semanticProvider: unavailable`, `failureCode: VOYAGE_PROVIDER_ERROR`, `revalidating: false` — grace refused because the last verification failed |
| Cache **and** grace both elapse | still HTTP **503** — grace never resurrects a failed provider |
| Real credential restored, probe succeeds | HTTP **200** `ready` |
| Next cache boundary after recovery | HTTP **200** `ready`, `revalidating: true` |

A sustained outage is never hidden, and recovery is automatic.

The bound was also confirmed accidentally, which is the most convincing kind. The
readiness endpoint was left completely idle for over six minutes after a probe at
18:43:33. Cache expired at 18:48:33, grace at 18:49:33, and the next read at
18:49:49 — sixteen seconds past the window — correctly returned **503**, started
a probe, and returned 200 from the following read. No provider failure occurred
(no `unavailable` transition was ever logged). Last-known-good really does
expire.

In a real deployment this state is hard to reach, because the platform polls
readiness continuously and every poll refreshes the cache long before the grace
runs out. It appears here only because the endpoint was left entirely untouched.

## Issue C — Voyage 429 assessment

**Verdict: PROVIDER CAPACITY / ENVIRONMENT REQUIREMENT, not an application
defect.** Verified against the existing retry and write paths:

| Property | Evidence |
| --- | --- |
| No fallback vectors | `prepareDocumentEmbedding` throws; nothing substitutes a vector. The similarity route returns 503 `semantic_unavailable` with `semanticAvailable: false`. |
| No partial or invalid write | `submission.service` prepares the embedding **before** opening the transaction and raises 503 `SEMANTIC_SYNC_UNAVAILABLE` on failure, so no row is written. |
| Retry is bounded | `MAX_VOYAGE_ATTEMPTS = 3` over statuses `[429, 500, 502, 503]`; 61 s wait on 429, otherwise 1 s × attempt. Worst case is bounded at roughly 150 s. |
| Failure stays honest | The client sees a controlled semantic-unavailable category; provider internals are never exposed. |

One genuine observability gap was found and closed: a 429 previously produced the
same generic `VOYAGE_PROVIDER_ERROR` code as a 500 or a malformed response, so
throttling was indistinguishable from a provider fault in readiness output and in
the `Voyage provider status changed` log line. Rate limiting now carries its own
`VOYAGE_RATE_LIMITED` code. Retry behaviour is unchanged because backoff keys on
the HTTP status, and error categorisation is unchanged because it keys on the
error name.

**Phase 8B must treat Voyage quota as an explicit staging acceptance item**:
determine whether the real account tier sustains departmental import volume plus
concurrent submissions. No provider plan was purchased or changed here.

## An important consequence of exceeding the request budget

During this investigation a 650-user commit exceeded the 300 s proxy budget and
the client received **HTTP 504** — but the backend **completed the commit anyway
and created all 650 accounts**.

This is not a data-integrity failure: the batch is atomic and the committed
cohort is consistent, which is exactly the Phase-3 guarantee. It is a
**credential-delivery failure**: the one-time credential manifest is returned in
the commit response, so a proxy timeout strands a fully created cohort whose
temporary passwords nobody holds. Verified state of that cohort: 650 accounts,
all `ACTIVE`, all `mustChangePassword`, none accepted.

Recovery exists and does not require plaintext storage — bulk invitations
(`POST /api/v1/admin/users/invitations/bulk`) let each account establish its own
password, and the per-user admin credential reset remains available.

This raises the stakes on the hosted request budget considerably: exceeding it
does not merely return an error, it silently strands a committed cohort. **A
hosting platform whose hard request limit is below the proven requirement must be
rejected in Phase 8B**, not worked around.

### The abandonment was also invisible in the backend logs

Investigating the above exposed a related observability gap. Request-completion
logging was attached only to the response `finish` event. When a proxy gives up
first it destroys the socket, so `finish` never fires — and a request that ran
for five minutes and committed 650 accounts produced **no HTTP log line at all**.
An operator saw a 504 at the edge and nothing whatsoever from the application.
Only the batch audit record showed what had really happened.

The correlation middleware now emits exactly one line either way: the normal
completion entry, or — when the client disconnected first — a warning
`Request abandoned by client before the response was sent` carrying the same
correlation fields plus `clientAborted: true`. Normal responses are unaffected:
`finish` followed by `close` still produces exactly one entry.

Verified in the container by abandoning a 40-user commit after 6 seconds:

```json
{"clientAborted":true,"durationMs":6077,"level":"warn",
 "message":"Request abandoned by client before the response was sent",
 "method":"POST","path":"/api/v1/admin/users/import/commit",
 "requestId":"9c6820dd-a202-4203-9df8-781a027e2b18","userId":1}
```

The backend continued and committed all 40 accounts anyway — the stranded-cohort
scenario in miniature, now visible in the log stream instead of silent.

Read the `durationMs` on this entry precisely: it is the time until the client
gave up, which is when the socket closes, **not** how long the backend went on
working afterwards. The line says "this operation was abandoned and may still
have committed", and the batch audit record remains the authority on what
actually landed. That is the signal an operator needs to go looking, so it was
fixed here rather than deferred.

## Automated verification

Run against the final tree.

| Check | Result |
| --- | --- |
| Backend test suite | **73 suites, 923 tests, all passing** (was 903 — 20 tests added) |
| Frontend test suite | **31 files, 338 tests, all passing** |
| Frontend build | exit 0 |
| Frontend lint | exit 0, clean |
| `docker compose config --quiet` (production) | exit 0 |
| `docker compose config --quiet` (with acceptance overlay) | exit 0 |
| New setting rendered into Compose | `VOYAGE_READINESS_STALE_GRACE_MS: "60000"` |
| Deployment contract tests | `PASS - static deployment contract` |
| Smoke-script tests | 3 tests, 3 pass, 0 fail |
| Full-stack Compose smoke (HTTPS edge) | **8/8 PASS**, including `readiness: ready` |
| Backend `npm audit --omit=dev` | 2 moderate (`uuid` via `exceljs`) — unchanged pre-existing finding |
| Frontend `npm audit --omit=dev` | **0 vulnerabilities** |

### A note on frontend test timing

On the first two runs the frontend suite reported 9 and then 4 failures. Every
one was `Test timed out in 5000ms` or `20000ms` — no assertion failed, the failing
set differed between runs, and no frontend file was changed in this phase. The
suite took 213–241 s against 96 s during container acceptance, because the host
was running at 802 MHz. Re-running with only the timeout raised
(`--testTimeout=60000 --hookTimeout=60000`) passed **31/31 files, 338/338 tests,
exit 0**. These are host-speed flakes, not a regression; the suite's default
timeouts are simply tight for a heavily throttled machine.

## Regression confirmation

Unchanged and re-verified by the passing suites: the Voyage model
(`voyage-4-large`), 1024 dimensions, `structured-context-v1`, similarity
thresholds and LOW/MEDIUM/HIGH boundaries, Jaccard, TF-IDF, ranking, topic
lifecycle, import atomicity, bulk replay semantics, **bcrypt cost 12**,
credential-manifest security, identity rules, invitation/reset security, and
authorization/rate-limit policy.

The defence baseline tag `v0.5.0-defense-baseline` remains at
`1898a96e95fb2fb635f8f08b777cb129fdb7529f`.

## Updated hosted-staging requirements

Carried into Phase 8B as acceptance criteria:

1. **Request budget ≥ 600 s** on every hop including the platform's own hard
   limit — or a measured host with ≥ 3.25 bcrypt cost-12 hashes/second and a
   budget set from its own figure with ≥ 1.5× margin. **A platform that cannot
   meet this is rejected**, because exceeding the budget strands a committed
   cohort's credentials rather than merely erroring.
2. **Measure `BULK_HASH_CONCURRENCY` on the target host** and set it explicitly.
   The default now derives from physical cores and the cgroup CPU quota, but a
   hosted container's real allowance should be confirmed rather than inferred.
3. **Voyage account capacity is an explicit acceptance item.** Determine whether
   the real tier sustains departmental import volume plus concurrent
   submissions. Provider throttling is now visible as `VOYAGE_RATE_LIMITED`.
4. **Health gating**: restart on `/api/v1/health` (liveness); admit traffic on
   `/api/v1/readiness`. Routine refresh no longer flaps, so a readiness failure
   now means something real.
5. **Alert on `clientAborted: true`** for administrative endpoints — it means an
   operation may have committed without its operator receiving the result.
