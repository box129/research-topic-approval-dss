# Voyage Semantic Threshold Decision

`SEMANTIC_THRESHOLDS_FROZEN`

The provisional production semantic thresholds are:

- LOW: score `< 0.5503426097449364`
- MEDIUM: `0.5503426097449364 <= score < 0.6350044680721263`
- HIGH: score `>= 0.6350044680721263`

They are benchmark-calibrated technical thresholds for Voyage
`voyage-4-large`, 1024D float, structured-context-v1, cosine similarity,
query `input_type=query`, and document `input_type=document`. HIGH indicates
higher semantic similarity requiring lecturer attention; it is not automatic
rejection, plagiarism, a confirmed duplicate, or misconduct. Academic
judgment remains human.

Reassess these thresholds if the provider/model or representation changes, a
substantial expert or departmental benchmark becomes available, the domain
distribution materially shifts, or a substantially larger validated dataset is
added. Individual repository topics alone do not trigger recalibration.
