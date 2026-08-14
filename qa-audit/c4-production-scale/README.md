# C4 audit boundary

C4 evaluates performance of the frozen exact persisted-vector retrieval architecture only. Its cloned fixture is technical test data, not a departmental corpus and not evidence of semantic accuracy, threshold quality, provider superiority, or topic prevalence.

No result is claimed until an authorized run has produced and reviewed a raw result JSON file. The decision gate is evidence-only: retain exact scan when measured 5,000-topic p95 local latency is operationally acceptable; otherwise stop for architecture review before considering pgvector or ANN methods.
