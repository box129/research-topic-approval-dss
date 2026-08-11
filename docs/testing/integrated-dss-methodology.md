# Integrated DSS Baseline Methodology

- Jaccard input: title only, using the current production mathematical implementation.
- TF-IDF input: title only, using the current production mathematical implementation.
- Semantic input: stored Experiment 2B structured-context-v1 scores.
- Keywords are excluded because the frozen benchmark has no production-equivalent keyword field for every pair.
- Fixed weights and thresholds are current-contract design values, not calibrated values.
- Grouped threshold analysis reuses Stage A.1 connected components and fits thresholds only on outer-fold training data.
- No embedding model or external provider is called by this experiment.
