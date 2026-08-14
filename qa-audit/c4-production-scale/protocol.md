# C4 measurement protocol

1. Provision a separate PostgreSQL performance database outside development, staging, and production. Do not place URLs in Git.
2. Set `SOURCE_DATABASE_URL` to the approved demo source and `PERF_DATABASE_URL` to the dedicated target. Prepare `small`, `1000`, and `5000` fixtures separately; optional `10000` is not required for the decision gate.
3. Before each benchmark, the harness validates row count, active lifecycle eligibility, `voyage` provider, `voyage-4-large`, 1024 finite numeric values, `structured-context-v1`, matching source hash, and production `validStoredEmbedding` acceptance. The full validation occurs before warm-ups and is excluded from all local timing measurements.
4. For each scale and local concurrency 1, 5, and 10, use at least 3 warm-ups and 30 measured iterations. Save raw JSON with timestamp, Git commit, platform, CPU descriptor/count, total memory, fixture provenance, raw samples, raw batch timing/throughput, process-level RSS at phase/batch boundaries, and aggregate statistics.
5. Interpret local results as warm/repeated operational measurements. They do not reset Windows, PostgreSQL, filesystem, or process caches and must not be called cold-cache results.
6. Keep database retrieval, exact similarity/ranking, classification, and total local processing separate. The deterministic query vector is a technical probe and has no semantic interpretation.
7. Do not run provider latency without explicit reviewed authorization. If authorized, use the separate command with one query embedding per call and record provider/HTTP failures separately. Compose end-to-end observations only from separately preserved provider and local components.
