# C6 direct end-to-end latency harness

C6 is evaluation-only technical evidence for one direct request path: a `structured-context-v1` technical topic, one real `voyage-4-large` query embedding, then the C4B resident exact 5,000-vector corpus using the frozen scorer and classifier. It is not departmental traffic evidence, semantic-accuracy evidence, or a provider SLA.

Run from `backend/` only after authorization and a prepared valid 5,000-record performance fixture:

```powershell
node -r dotenv/config evaluation/end-to-end/run-c6-end-to-end.js --execute --runs 10 --delay-ms 21000 --output ../qa-audit/c6-end-to-end/results/c6-end-to-end.json
```

`--execute`, `--runs`, and `--delay-ms` are mandatory. C6 is limited to concurrency 1 because the Voyage project is rate-limited to 3 RPM. The delay occurs after an attempt and is excluded from provider, local, and direct end-to-end timing.

The corpus is loaded and integrity-checked once before three local-only warm-ups. No database read occurs during provider attempts; no document embedding or database write occurs. Each successful raw record is compact and contains only timing, count, risk, and top-match metadata—never a full query vector or stored embedding.

C6 p95 must be computed only from directly measured `endToEndLatencyMs` values for the same requests. Independent C5 provider p95 and C4B local p95 must never be added and reported as C6 p95.
