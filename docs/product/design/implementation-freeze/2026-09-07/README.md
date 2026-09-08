# Implementation Freeze Record — Authenticated Workspace (2026-09-07)

**Status: AUTHENTICATED UI FREEZE — FINALIZED AND VERIFIED**

Freeze record merged via PR #154 on 2026-09-08. Freeze-record commit on main:
`409d8a31b6d0da90fd6da63ce6b707607464debb`. The captured frontend implementation
remains `24b01bca1c80d54661eeea8d0800f3d05782fe22`.

This package is the formal record of the authenticated-workspace user interface as
implemented at a single, named commit, captured from the real running system. It is
an *implementation freeze* record: evidence of what the product actually renders.
It is distinct from the *design-reference freeze* under
`docs/product/design/frozen/` (2026-08-31), which preserves the approved design
boards, the landing design history, and the original 28-state authenticated
capture set. Nothing under `docs/product/design/frozen/` was modified by this
package; that pack remains the historical design authority and coverage floor,
and this pack supersedes it only as the *current* implementation evidence.

## Frozen implementation

- **Commit:** `24b01bca1c80d54661eeea8d0800f3d05782fe22` (`origin/main`)
  — `fix(frontend): hide zero-result pagination (#153)`
- **Consistency chain closed by this freeze:** PR #149 (empty vs filtered
  states), PR #150 ("Revision requested" workflow vocabulary), PR #151 (neutral
  similarity aggregate vocabulary), PR #152 (neutral stored lecturer feedback),
  PR #153 (hide zero-result pagination). The approved landing redesign merged
  as PR #148 immediately before the chain.
- **History:** the approved design boards and the landing evolution are
  documented in the design-reference freeze; this record does not restate them.

## Verification at the frozen commit

Run from a clean worktree checked out at the frozen commit, before capture:

- **Tests:** 507/507 passing across 39 files (frontend suite; Voyage provider
  mocked per the standing test policy — no live paid API calls in tests).
- **Build:** production build PASS.
- **Lint:** 10 pre-existing findings, 0 new at the frozen commit.
- **Product-code immutability:** capture and packaging changed no product code;
  `git diff origin/main --name-only` for this branch contains only
  `docs/product/design/implementation-freeze/2026-09-07/` paths.

## Capture evidence

- **Pack:** `authenticated-captures/` — **50 full-page PNG captures** across the
  student, lecturer, and administrator workspaces plus the shared auth
  surfaces; desktop canon 1440 px, mobile canon 390 px, deviceScaleFactor 1.
- **Manifests:** `authenticated-capture-manifest.md` (human-readable, per-file
  semantic proof) and `authenticated-capture-manifest.json` (machine-readable,
  per-file SHA-256, overflow proof, environment). `authenticated-capture-sha256.txt`
  is the filename-sorted integrity list. All three agree on the same 50-file
  set; all 50 hashes are unique; no zero-byte files.
- **Duplicate removed:** `lecturer-review-decision-controls-desktop.png` was
  removed as a byte-duplicate of `lecturer-review-pending-desktop.png` (both
  full-page exports of the same page state once captures were parked at the
  top of the page). The decision controls remain fully evidenced inside the
  review-pending desktop and mobile captures.
- **Environment:** real frontend (vite dev server of the freeze worktree) with
  the real Express backend and disposable local PostgreSQL databases; live
  Voyage `voyage-4-large` served every classified check (document embeddings
  backfilled 9/9 before capture). Auxiliary instances of the same backend
  build provided the genuine-empty states (`:3001`, scratch database with
  users only) and the provider-unavailable states (`:3002`, `VOYAGE_API_KEY`
  unset). Full details, including two honestly-recorded environment caveats
  (the part-a port label and the part-d IPv4 forwarding), are in the JSON
  manifest's `environment` block.
- **Every capture was visually inspected** and re-generated where the first
  export caught a transient state (a mid-flight bulk-import preview, a
  mid-flight similarity check, and full-page exports taken while the page was
  scrolled, which painted the sticky header mid-page).

## Capture data policy

Synthetic, disposable demo data only — no real departmental data, and the
defence database was never used. Student identity is matric-first
(`DEMO/2025/0001` with no email address; `DEMO/2025/0002` with a personal
`example.com` address); staff demo accounts use the stock
`*.demo@uniosun.edu.ng` fixtures. No screenshot contains the Voyage API key,
JWT/session secrets, passwords, or database credentials. No API response was
faked in the DOM; the two hard-to-reach backend states were produced by real
backend instances configured into those states. No irreversible bulk commit
was executed for a screenshot (the bulk-onboarding capture is preview-only and
its screen says so).

## Semantic truthfulness (frozen contract, verified in the captures)

- Similarity classification is presented as **Higher / Moderate / Lower
  similarity / Not classified**, with the stored token (e.g. mono `HIGH`) as
  approved subordinate metadata, and the score always as a raw cosine with the
  "technical similarity score, not a percentage" disclosure.
- An empty comparison corpus renders **"No comparison could be made… This does
  not establish that the topic is new or original."** — absence of evidence is
  never presented as originality.
- Provider failure renders the explicit **"check could not run"** state: no
  result, no classification, no fallback vectors, proposal retained.
- Workflow vocabulary is **Pending review / Approved / Revision requested /
  Rejected**; repository lifecycle is **Historical / Current session / Under
  review**; stored lecturer rationale renders on neutral surfaces while status
  chips keep semantic colour.
- Genuine-empty and filtered-empty states are distinguished on every list
  surface, and zero-result sets render **no pagination UI at all** (PR #153 —
  no "Page 1 of 0").
- Responsive parity: each mobile capture carries the same truthful meaning as
  its desktop counterpart, and every capture passed the horizontal-overflow
  gate (`scrollWidth == clientWidth`).

## Accepted items — not freeze defects (do not reopen)

- My Submissions derives **"Revision required" / "Revised"** labels for the
  student's own lineage view (approved derived vocabulary, distinct from the
  canonical status chip).
- **Research Explorer** is an honest deferred stub ("not currently available"),
  by scope decision.
- Toast wording and the admin side-tab accent remain as approved.
- Internal identifiers (`byRisk`, `highRisk`/`mediumRisk`/`lowRisk`,
  `similarityRisk`, `awaiting_revision`/`awaitingRevision`, `hasSbertScores`)
  are non-rendered API/code names and stay unchanged by design.
- Repeated similarity snapshots per submission are truthful additive history,
  not duplication.
- The student dashboard's quick-stat chips are the approved fixed set (Total /
  Pending / Revision requested / Approved).
- The pending-reviews genuine-empty panel's lowercase "View my decisions" is
  approved Board C copy.

## UI FREEZE ≠ PRODUCTION READINESS

**This record freezes the user interface only.** It is explicitly **not** a
production-readiness sign-off. The following remain open, owned by later
phases, and are unaffected by this freeze:

- User onboarding at departmental scale (beyond the demo/bootstrap accounts),
  including the bootstrap/temporary-password flow hardening.
- Email/SMTP delivery (invitations, notifications) and self-service password
  recovery.
- Trust-proxy configuration and production-grade rate limiting (the current
  auth limiter is in-memory and resets on restart).
- Dependency upgrades, deployment/hosting, and observability (logging,
  metrics, alerting; the admin dashboard truthfully reports the Voyage
  provider health as "unknown / not checked yet").
- Corpus-embedding lifecycle operations: backfill single-flight guard,
  the 48-hour retention job, partial-corpus handling, and calibration
  provenance records.
- Duplicate-submission guard and related workflow hardening.
- The `hasSbertScores` legacy flag clean-up (internal, non-rendered).

The frozen semantic scoring contract (Voyage `voyage-4-large`, 1024-dim,
`structured-context-v1`, C1.5 thresholds, LOW/MEDIUM/HIGH boundaries, ranking
semantics, no fallback vectors) is research-frozen and was not altered by any
work in this chain.
