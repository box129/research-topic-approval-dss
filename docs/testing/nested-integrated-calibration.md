# Nested Group-Aware Integrated Calibration

Nested five-fold grouped outer evaluation with four inner grouped folds, a predeclared 0.10 simplex grid, and stored Stage B1 scores only.

| Provider | Track | Accuracy | Macro-F1 | Selected weights across outer folds |
| --- | --- | ---: | ---: | --- |
| sbert | unrestricted | 0.758333 | 0.757388 | 0.0/0.0/1.0 (4), 0.0/0.1/0.9 (1) |
| sbert | strictTri | 0.6 | 0.606067 | 0.1/0.1/0.8 (4), 0.2/0.1/0.7 (1) |
| openai | unrestricted | 0.783333 | 0.784747 | 0.0/0.0/1.0 (5) |
| openai | strictTri | 0.6 | 0.577497 | 0.1/0.1/0.8 (4), 0.1/0.2/0.7 (1) |
| voyage | unrestricted | 0.8 | 0.800585 | 0.0/0.0/1.0 (5) |
| voyage | strictTri | 0.675 | 0.644546 | 0.1/0.1/0.8 (5) |
| gemini | unrestricted | 0.758333 | 0.761312 | 0.0/0.0/1.0 (5) |
| gemini | strictTri | 0.5 | 0.452039 | 0.6/0.1/0.3 (1), 0.1/0.1/0.8 (1), 0.6/0.2/0.2 (2), 0.2/0.3/0.5 (1) |

The unrestricted and strict-tri tracks are separate exploratory calibration analyses; no selected configuration is a production recommendation.
