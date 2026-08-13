# Voyage C1.4 Threshold Calibration Methodology

This local analysis uses only the 120 completed C1.2 `voyage-4-large` 1024D
structured-context-v1 asymmetric pair-mean scores. It does not generate
embeddings or invoke a provider or model.

The existing five-fold connected-component grouped evaluation is preserved as
the unbiased benchmark estimate. One separate deployment calibration fits all
120 cases by evaluating adjacent unique-score midpoints, maximizing macro-F1,
then choosing lower `t1` and lower `t2` on ties. Fold thresholds are not
averaged.

Threshold stability uses 5,000 bootstrap development samples of the frozen 113
connected components (seed `20260810`). These are provisional
benchmark-calibrated technical thresholds, not departmental policy or expert
validated thresholds.
