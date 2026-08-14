# C7 query-repeatability audit

C7 measures technical repeatability of ten identical Voyage query embeddings and stability of frozen exact DSS decisions against a cloned 5,000-record resident corpus. It is not semantic-accuracy evidence, departmental prevalence evidence, a provider SLA, a provider-wide determinism guarantee, or threshold recalibration.

Future authorized execution from `backend/` requires `--execute`, `--runs`, `--delay-ms`, and `--output` (reviewed configuration: `--runs 10 --delay-ms 21000`). Calls are concurrency 1 with no retry. C7 records only fingerprints and compact decision/probe evidence, never vectors, embeddings, or credentials.

Fixed threshold probes are constructed once from the first successful normalized query vector and reused unchanged for all later vectors. Boundary crossings are observed operational sensitivity only; C7 must not automatically change thresholds.
