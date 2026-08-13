# C1.5 Voyage Production-Direction Calibration

The frozen benchmark explicitly labels every side as `submitted` or `existing`.
Accordingly, the production score is `cosine(submitted_query, existing_document)`.
This local analysis uses only the completed C1.2 1024D Voyage query/document
artifacts; it makes no provider or model calls. Detailed directional metrics,
grouped evaluation, full-data calibration, bootstrap stability, and sensitivity
are in `backend/evaluation/results/voyage-production-direction-calibration.json`.
