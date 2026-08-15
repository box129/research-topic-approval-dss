# Final report visual-evidence index

## 1. Screenshot environment/worktree

Worktree: `topic-similarity-voyage-scale-eval`, branch
`experiment/voyage-production-scale-evaluation`, commit `5245afb` at audit
start (frontend provenance `e3a285b`; resident-corpus implementation `49c7ac7`).
This is the only listed worktree containing the final frontend together with the
final resident-corpus backend. No screenshots were fabricated or captured
without a legitimate authenticated application session.

## 2. Final screenshot inventory

| Required file | Genuine route/component | API/data | Status / claim boundary |
|---|---|---|---|
| `figure-4-5-final-topic-check-interface.png` | `/student/check-my-topic`, `frontend/src/pages/student/CheckMyTopicPage.jsx` | similarity adapter | Not captured: authenticated live application session unavailable. The page contains title, population, location, study focus and check action in code. |
| `figure-4-6-final-similarity-results.png` | Student/lecturer check result states; `ResultsDisplay.jsx` | `/api/similarity/check` | Not captured: no pre-existing legitimate result/session was available; no provider call was made. A later genuine result illustrates UI evidence, not algorithmic accuracy. |
| `figure-4-7-lecturer-review.png` | lecturer submission detail, `SubmissionDetailPage.jsx` | lecturer submission/detail APIs | Not captured: requires authenticated lecturer data/session. It demonstrates human decision workflow, not a final automatic decision. |
| `figure-4-8-topic-repository.png` | `/admin/topic-repository`, `TopicRepositoryPage.jsx` | admin topic repository API | Not captured: requires authenticated admin data/session. It demonstrates repository/lifecycle management only. |

No optional dashboard image is justified without a genuine authenticated state.

## 3. Figure 3.1 — Design science process

Nodes/arrows: Requirements investigation → Initial artefact → semantic-baseline
verification → similarity/provider evaluation → B1/B2/B3 evaluation → artefact
refinement → final semantic implementation → production-scale/technical
evaluation. Sources: Git history through `6e68080`, `c61d00a`, `a46306d`,
`49c7ac7`. Caption: *Design science research process used to refine the DSS.*

## 4. Figure 3.2 — Investigated workflow

Main path: Proposed topic → lecturer checks Excel historical repository → keyword
search → alternative terminology where necessary → related historical/recent
topics considered → population/scope considered → human academic judgement.
Side branch: initially approved topic → not immediately visible in completed
project repository → proposal-stage change/rejection may occur → temporary
visibility gap. Source: verified key-informant evidence only; the 48-hour rule
is excluded. Caption: *Investigated undergraduate topic-checking workflow.*

## 5. Figure 3.3 — Initial tri-algorithm artefact

Submitted topic branches to Jaccard (0.20), TF-IDF+cosine (0.30), and SBERT
(0.50) → weighted combination → initial LOW/MEDIUM/HIGH. Source:
`backend/src/config/similarityScoring.config.js` historical contract. Caption
must say **Initial artefact**, not final production architecture.

## 6. Figure 3.4 — Controlled benchmark

120 researcher-constructed pairs (LOW 39, MEDIUM 41, HIGH 40) → shared topic
identities → 113 connected components → group-aware partitioning → training-only
threshold fitting → held-out evaluation → no topic identity crossing partitions.
Source: `backend/evaluation/results/voyage-production-direction-calibration.json`
at `f925a95`; SHA-256 `b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0`.

## 7. Figure 3.5 — Refinement sequence

Experiment 0 → 0B → Experiment 1 → Experiment 2B → group-aware correction →
B1 → B2 → B3 → semantic-only freeze → Voyage selection → C1.5 directional
calibration → C2 → C4 → C4B → C5 → C6 → C7 → resident-corpus productionisation.
Source: commit chronology and `FINAL_ARTIFACT_EVIDENCE_AUDIT.md`. Negative
experiments remain part of the chronology.

## 8. Figure 4.1 — Final semantic DSS architecture

React frontend → Express backend → structured-context-v1 → Voyage query
embedding. PostgreSQL topic records plus persisted document-vector provenance →
resident valid 1024D corpus → exact cosine retrieval → technical LOW/MEDIUM/HIGH
→ lecturer/panel human academic decision. Readiness checks DB/configuration;
import/controlled refresh feeds the corpus. Sources: `voyageEmbedding.service.js`,
`residentCorpus.service.js`, `similarity.controller.js`, commits `6e68080`,
`49c7ac7`.

## 9. Figure 4.2 — Final processing workflow

Submitted topic → structured-context-v1 → one Voyage query embedding → valid
resident document vectors → exact cosine → rank top related topics → apply T1/T2
→ technical classification → human review/decision. Source: production services
and `voyageSemanticProduction.test.js`.

## 10. Figure 4.3 — Persistent embedding flow

Stored topic → canonical semantic source → valid persisted embedding? Validity:
provider, model, dimension, representation, source hash, finite 1024D vector.
YES → reuse; NO → generate document embedding → persist vector/provenance/hash
→ resident refresh/admission. Source: `voyageEmbedding.service.js`,
`backfill-topic-embeddings.js`, `residentCorpus.service.js`. It is not a
per-request document-embedding flow.

## 11. Figure 4.4 — Resident coherence

All lifecycle records → candidate load → frozen-contract validation → complete
candidate snapshot → atomic swap → active resident corpus. Import → immediate
refresh; other persisted change → controlled 5-second refresh; failure → preserve
previous snapshot; initial failure → semantic unavailable. Request-time
under-review 48-hour eligibility filtering is a **researcher/system-design
rule**, not departmental policy. Source: `residentCorpus.service.js`, `49c7ac7`.

## 12. Optional chart data

C4 5,000/c1 total p95: `6726.1219 ms`; C4B 5,000/c1 request p95:
`191.0711 ms`; C4B ranking p95: `188.9982 ms`. Sources:
`qa-audit/c4-production-scale/results/local-5000-c1.json` and
`c4b-5000-c1.json`. These compare implementations on a technical cloned fixture.
B1 semantic-only versus weighted macro-F1: NOT EXTRACTED in this pass; use only
the frozen B1 artifact before drawing that optional chart.

## 13. Claim boundaries / missing evidence

No screenshot proves accuracy, provider SLA, arbitrary institutional concurrency,
or departmental 48-hour policy. The indispensable remaining visual gap is four
genuine authenticated UI captures from the final combined worktree; none may be
substituted with mock states.
