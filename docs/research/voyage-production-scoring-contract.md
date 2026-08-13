# Voyage Production Scoring Contract

`PRODUCTION_SEMANTIC_THRESHOLDS_FROZEN`

The production semantic score is `cosine(new_topic_query, stored_topic_document)`.
It respects Voyage query/document retrieval roles and does not use the C1.4
bidirectional pair mean. The C1.5 thresholds are `t1 = 0.5571529891797358`
and `t2 = 0.6450102471881145`. They remain benchmark-calibrated technical thresholds, not
departmental policy or automatic-rejection thresholds.
