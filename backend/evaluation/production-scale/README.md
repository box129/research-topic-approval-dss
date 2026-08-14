# C4 production-scale evaluation harness

This directory is evaluation-only. It measures the frozen production exact local vector scan; it does not change production retrieval, scoring, thresholds, API responses, or lifecycle behavior.

## Safety and fixture provenance

`prepare-scale-fixture.js` requires both `SOURCE_DATABASE_URL` and `PERF_DATABASE_URL`. It refuses to use a missing target, a target equal to `DATABASE_URL`, a target equal to the source, or a URL naming `topic_similarity_v1_dev`. It also refuses to replace existing target lifecycle records unless `--replace` is supplied explicitly.

The source records must already have valid, persisted `voyage-4-large`, 1024-dimensional, `structured-context-v1` document embeddings with a matching source hash. The fixture copies the exact semantic fields and embedding metadata together. It duplicates existing valid demo records with a roughly preserved lifecycle mixture; it is a technical scale fixture only and is not a real departmental distribution or semantic-quality dataset.

Under-review clones receive a fresh `reviewStartedAt` so they meet the same 48-hour production eligibility rule. No topic text is changed while reusing its embedding.

## Commands

Prepare a dedicated performance database only after its schema has been provisioned separately:

```powershell
$env:SOURCE_DATABASE_URL = '<source database URL>'
$env:PERF_DATABASE_URL = '<dedicated performance database URL>'
node backend/evaluation/production-scale/prepare-scale-fixture.js --size small
node backend/evaluation/production-scale/prepare-scale-fixture.js --size 1000 --replace
node backend/evaluation/production-scale/prepare-scale-fixture.js --size 5000 --replace
```

`--size` accepts `small`, `1000`, `5000`, or optional `10000`; `--batch-size` defaults to 250. Before any target deletion or write, the harness queries both PostgreSQL connections for their actual database name and server endpoint. It requires the target name to include `topic_similarity_c4_perf` and rejects a resolved source/target identity match. Preparation is the only destructive command; never point it at development, staging, or production. URLs are never printed.

Run local measurements after preparing the matching fixture:

```powershell
node backend/evaluation/production-scale/run-local-scale-benchmark.js --scale small --output backend/evaluation/results/c4-small.json
node backend/evaluation/production-scale/run-local-scale-benchmark.js --scale 1000 --concurrency 1 --output backend/evaluation/results/c4-1000-c1.json
node backend/evaluation/production-scale/run-local-scale-benchmark.js --scale 5000 --concurrency 5 --output backend/evaluation/results/c4-5000-c5.json
```

The local benchmark defaults to 3 warm-ups and 30 measured iterations. It validates the full fixture once before warm-ups, then supports controlled local concurrency `1`, `5`, or `10`. It records database retrieval, lifecycle assembly, exact vector similarity/ranking, classification, total local processing, searchable/valid vector counts, failures, raw samples, batch wall-clock timing/throughput, and process-level RSS at measured-phase and batch boundaries. The fixed deterministic 1024D query vector is solely a computational probe; its scores have no research interpretation.

These are warm/repeated operational measurements, not defensible cold-cache PostgreSQL measurements. Windows and PostgreSQL cache state are not reset by this harness.

## Provider and end-to-end preparation

Provider latency is deliberately disabled unless explicitly authorized at runtime:

```powershell
node backend/evaluation/production-scale/run-provider-latency-benchmark.js --execute --runs 10 --delay-ms 1000
```

That command makes one `voyage-4-large` query embedding per run using `structured-context-v1`, performs no document embedding and no database write, and reports raw successful samples plus 429, 5xx, provider/transport, and unexpected failures separately. `--delay-ms` is mandatory and must be chosen only after reviewed account rate limits. Do not run it without approval.

For a later end-to-end measurement, run that provider command and the local benchmark against the same prepared fixture, retaining both component reports separately. Their sum may be reported only as an explicitly composed end-to-end observation; rate-limit delays are never included in local retrieval latency.
