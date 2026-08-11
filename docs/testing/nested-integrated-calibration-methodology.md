# Nested Integrated Calibration Methodology

- Frozen title-only Jaccard and TF-IDF scores were read from Stage B1; stored structured-context-v1 semantic scores were read from Stage B1/Experiment 2B.
- The exact Stage A.1 connected components and five outer folds were reused.
- Each outer training partition was divided into deterministic four-way group-aware inner folds.
- All 66 .10-step simplex weights were considered for unrestricted selection; strict tri requires every weight at least .10.
- Inner validation selected mean macro-F1, then accuracy and predeclared deterministic tie-breaks. Thresholds were fitted on training data only.
- Outer test labels were excluded from selection and used once for final evaluation.
