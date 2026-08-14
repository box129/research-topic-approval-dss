# C4B in-memory exact-corpus evaluation

This is an evaluation-only prototype. It does not alter production controllers, APIs, schemas, provider behavior, scoring, or C4 baseline results.

`corpus-loader.js` loads the three lifecycle tables once from `PERF_DATABASE_URL`, preserves ordinary JavaScript numeric arrays exactly as returned from persisted JSON, admits only records accepted by the frozen `validStoredEmbedding`, and retains valid under-review rows even when they are temporarily ineligible. Each check evaluates the 48-hour under-review rule at query time, then calls the unchanged production `retrieve()` and `classify()`.

Run future-only commands from `backend/`; plain `node` does not automatically load the backend `.env`:

```powershell
node -r dotenv/config evaluation/production-scale/in-memory/run-in-memory-benchmark.js --scale small --expected-size 7 --concurrency 1 --output ../qa-audit/c4-production-scale/results/c4b-small-c1.json
node -r dotenv/config evaluation/production-scale/in-memory/run-in-memory-benchmark.js --scale 5000 --concurrency 1 --output ../qa-audit/c4-production-scale/results/c4b-5000-c1.json
node -r dotenv/config evaluation/production-scale/in-memory/run-parity-comparison.js --output ../qa-audit/c4-production-scale/results/c4b-parity.json
```

Prepare the dedicated performance fixture at the requested scale before benchmarking. The benchmark performs no database writes and refuses any fixture whose admitted/searchable count differs from the requested numeric scale, contains rejected vectors, or omits `--expected-size` for `small`.

Neither command has been executed as part of implementation. The benchmark reports corpus-build database/validation/total timings and RSS/heap snapshots separately from per-check lifecycle, ranking, classification, actual service processing, request latency from a common event-loop release, and batch throughput. It uses one shared read-only corpus snapshot; synchronous checks remain serialized by Node's event loop, so concurrency results explicitly include queueing. The parity command reads the database once, builds the candidate from that same snapshot, and records per-query identity/order, class/risk parity, and maximum unrounded score difference with a `1e-12` tolerance.

The automated parity boundary cases use `epsilon = 1e-10` around each frozen threshold (`T1 - epsilon`, `T1`, `T1 + epsilon`, and likewise for `T2`). This is only a controlled numerical classification check; no threshold is rounded or changed.

`CorpusStore` models only the future refresh safety requirement: build a complete new valid corpus, then atomically replace the old one. A failed refresh retains the prior valid corpus but records `stale_refresh_failed`; an initial failure is explicitly `unavailable`. It does not implement production invalidation.
