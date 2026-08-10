# Expanded Semantic Benchmark Review

## Scope and governance

This controlled 120-pair benchmark is manually constructed technical evaluation data. It is not lecturer-reviewed ground truth, not departmental ground truth, and not final production validation evidence. No embedding model or provider was consulted while constructing or revising labels.

- LOW / MEDIUM / HIGH: 39 / 41 / 40
- Provenance: `manually_constructed_expanded_benchmark`
- Validation status: `not_department_expert_validated`

## Human-reviewed policy revision

- expanded-low-010 LOW -> MEDIUM
- expanded-low-016 LOW -> MEDIUM
- expanded-low-040 LOW -> MEDIUM
- expanded-medium-015 MEDIUM -> LOW
- expanded-medium-030 MEDIUM -> LOW
- expanded-medium-040 LOW -> MEDIUM

The initial design targeted a 40 / 40 / 40 class distribution. Final human review found that the balance-restoration LOW label for `expanded-medium-040` was not independently defensible. It was restored to MEDIUM: waiting-time measurement and clinic-attendance barriers are distinct research questions, but waiting time is plausibly an attendance barrier and both topics concern primary-care access for the same attendee context. The frozen candidate therefore retains a deliberately near-balanced 39 LOW / 41 MEDIUM / 40 HIGH distribution rather than forcing another substantive label change. Label validity takes priority over exact arithmetic symmetry.

Replaced unrealistic cases: expanded-low-018 now contrasts postnatal family-planning and hepatitis-B-vaccination uptake; expanded-low-036 contrasts household water treatment and injection safety; expanded-low-038 contrasts oral rehydration and oral-health screening. All retain realistic Public Health wording and LOW hard-negative intent.

## Scenario distribution

- broad_disease_different_question: 7
- clearly_unrelated: 7
- documentation_difference: 6
- exact_duplicate: 4
- fragmented_title: 5
- generic_public_health_overlap: 6
- lexical_context_distinction: 6
- misleading_lexical_overlap: 9
- near_duplicate: 6
- paraphrase: 7
- related_focus_same_context: 7
- related_outcome: 6
- rephrased_wording: 6
- same_context_unrelated_focus: 8
- same_disease_different_location: 7
- same_disease_different_population: 7
- shared_terminology: 4
- similar_intervention_different_context: 6
- synonym_substitution: 6

## Controlled missing-context stress coverage

15 pairs have at least one incomplete topic side: population omissions 6, location omissions 7, study-focus omissions 4. Cases with two omitted fields: expanded-low-036 (existing population and study focus); expanded-high-040 has location absent on both sides. Missingness is deliberate robustness/stress coverage only, not an estimate of departmental historical missingness.

## Quality checks

Validation confirms 120 records, frozen support of 39 LOW / 41 MEDIUM / 40 HIGH, a maximum class-count difference of two, unique IDs, 120 unique unordered pairs, reversed-pair protection, titles present, required scenario/provenance/review metadata, correct benchmark governance, no benchmark metadata in topic inputs, and no complete topic record repeated more than twice. 11 complete topic records are intentionally reused once across related controlled comparisons.

Remaining human-review policy boundaries: broad-disease LOW/MEDIUM cases and location-only MEDIUM cases remain controlled judgement calls, not expert ground truth.

## Compact case index

| Case ID | Expected class | Scenario type | Short description |
| --- | --- | --- | --- |
| expanded-low-001 | LOW | clearly_unrelated | Different domain, population, and outcome. |
| expanded-low-002 | LOW | misleading_lexical_overlap | Shared generic wording but unrelated focus. |
| expanded-low-003 | LOW | same_context_unrelated_focus | Same context, unrelated research question. |
| expanded-low-004 | LOW | broad_disease_different_question | Same disease area, fundamentally different question. |
| expanded-low-005 | LOW | generic_public_health_overlap | Generic public-health terms only. |
| expanded-low-006 | LOW | shared_terminology | Mobile wording masks unrelated topic. |
| expanded-low-007 | LOW | clearly_unrelated | Unrelated public-health domains. |
| expanded-low-008 | LOW | misleading_lexical_overlap | Same attitude/student wording. |
| expanded-low-009 | LOW | same_context_unrelated_focus | Same students, unrelated focus. |
| expanded-low-010 | MEDIUM | broad_disease_different_question | Related HIV prevention and social context among the same youth cohort, but distinct research questions. |
| expanded-low-011 | LOW | generic_public_health_overlap | Shared health/use tokens only. |
| expanded-low-012 | LOW | shared_terminology | Screening/screen lexical trap. |
| expanded-low-013 | LOW | clearly_unrelated | Different subject matter. |
| expanded-low-014 | LOW | misleading_lexical_overlap | Practice/mothers overlap only. |
| expanded-low-015 | LOW | same_context_unrelated_focus | Same workplace, unrelated study. |
| expanded-low-016 | MEDIUM | broad_disease_different_question | Different diabetes study designs and populations, yet substantively related disease evidence. |
| expanded-low-017 | LOW | generic_public_health_overlap | Generic community-health overlap. |
| expanded-low-018 | LOW | misleading_lexical_overlap | Realistic shared “factors associated with uptake” wording, but different health behaviours and populations. |
| expanded-low-019 | LOW | clearly_unrelated | Entirely unrelated. |
| expanded-low-020 | LOW | misleading_lexical_overlap | Emergency/knowledge overlap. |
| expanded-low-021 | LOW | same_context_unrelated_focus | Same disease group, separate focus. |
| expanded-low-022 | LOW | broad_disease_different_question | Same disease, different technical question. |
| expanded-low-023 | LOW | generic_public_health_overlap | Health wording only. |
| expanded-low-024 | LOW | shared_terminology | Digital/use/staff overlap. |
| expanded-low-025 | LOW | clearly_unrelated | Unrelated social domains. |
| expanded-low-026 | LOW | misleading_lexical_overlap | Perception/rural overlap only. |
| expanded-low-027 | LOW | same_context_unrelated_focus | Same staff, unrelated focus. |
| expanded-low-028 | LOW | broad_disease_different_question | Disease name but different research object. |
| expanded-low-029 | LOW | generic_public_health_overlap | Awareness/students overlap. |
| expanded-low-030 | LOW | shared_terminology | Hesitancy population overlap. |
| expanded-low-031 | LOW | clearly_unrelated | Different populations and purpose. |
| expanded-low-032 | LOW | misleading_lexical_overlap | Salt term is misleading. |
| expanded-low-033 | LOW | same_context_unrelated_focus | Same cohort, unrelated service. |
| expanded-low-034 | LOW | broad_disease_different_question | Same disease label, different activity. |
| expanded-low-035 | LOW | generic_public_health_overlap | Health term only. |
| expanded-low-036 | LOW | misleading_lexical_overlap | Realistic public-health practices with generic practice/safety overlap but unrelated focus. |
| expanded-low-037 | LOW | clearly_unrelated | Unrelated healthcare and agriculture. |
| expanded-low-038 | LOW | misleading_lexical_overlap | Realistic oral/knowledge lexical overlap with different public-health subject and population. |
| expanded-low-039 | LOW | same_context_unrelated_focus | Same households, unrelated focus. |
| expanded-low-040 | MEDIUM | broad_disease_different_question | Different stroke questions, but both address stroke care within the same city. |
| expanded-medium-001 | MEDIUM | same_disease_different_population | Same disease and focus, different population. |
| expanded-medium-002 | MEDIUM | same_disease_different_location | Same topic, different location. |
| expanded-medium-003 | MEDIUM | similar_intervention_different_context | Similar intervention, changed context. |
| expanded-medium-004 | MEDIUM | related_focus_same_context | Related domain, distinct focus. |
| expanded-medium-005 | MEDIUM | related_outcome | Related mental-health outcomes. |
| expanded-medium-006 | MEDIUM | lexical_context_distinction | Shared wording, distinct behavior. |
| expanded-medium-007 | MEDIUM | same_disease_different_population | Population changes scope. |
| expanded-medium-008 | MEDIUM | same_disease_different_location | Location may justify separate study. |
| expanded-medium-009 | MEDIUM | similar_intervention_different_context | Intervention is related but setting differs. |
| expanded-medium-010 | MEDIUM | related_focus_same_context | Same disease, related but distinct behavior. |
| expanded-medium-011 | MEDIUM | related_outcome | Related wellbeing outcome. |
| expanded-medium-012 | MEDIUM | lexical_context_distinction | Attitude and behavior differ. |
| expanded-medium-013 | MEDIUM | same_disease_different_population | Population changes audience. |
| expanded-medium-014 | MEDIUM | same_disease_different_location | Same topic in different campus town. |
| expanded-medium-015 | LOW | similar_intervention_different_context | Mobile delivery channel overlaps, but antenatal attendance and HIV refill adherence are separate clinical objectives. |
| expanded-medium-016 | MEDIUM | related_focus_same_context | Related service questions. |
| expanded-medium-017 | MEDIUM | related_outcome | Related child-health outcomes. |
| expanded-medium-018 | MEDIUM | lexical_context_distinction | Same technology, different question. |
| expanded-medium-019 | MEDIUM | same_disease_different_population | Different target group. |
| expanded-medium-020 | MEDIUM | same_disease_different_location | Different locality. |
| expanded-medium-021 | MEDIUM | similar_intervention_different_context | Similar counselling, different life stage. |
| expanded-medium-022 | MEDIUM | related_focus_same_context | Related reproductive-health focus. |
| expanded-medium-023 | MEDIUM | related_outcome | Related occupational outcomes. |
| expanded-medium-024 | MEDIUM | lexical_context_distinction | Shared water context, distinct inquiry. |
| expanded-medium-025 | MEDIUM | same_disease_different_population | Different decision population. |
| expanded-medium-026 | MEDIUM | same_disease_different_location | Different location. |
| expanded-medium-027 | MEDIUM | similar_intervention_different_context | Same intervention, different risk behavior. |
| expanded-medium-028 | MEDIUM | related_focus_same_context | Related environmental practice. |
| expanded-medium-029 | MEDIUM | related_outcome | Related but separate outcome. |
| expanded-medium-030 | LOW | lexical_context_distinction | Social-media health-information seeking and problematic social-media use are materially different study focuses. |
| expanded-medium-031 | MEDIUM | same_disease_different_population | Different population. |
| expanded-medium-032 | MEDIUM | same_disease_different_location | Different clinic setting. |
| expanded-medium-033 | MEDIUM | similar_intervention_different_context | Same digital-health umbrella, different users. |
| expanded-medium-034 | MEDIUM | related_focus_same_context | Knowledge vs use. |
| expanded-medium-035 | MEDIUM | related_outcome | Related weight-management behaviors. |
| expanded-medium-036 | MEDIUM | lexical_context_distinction | Willingness differs from knowledge. |
| expanded-medium-037 | MEDIUM | same_disease_different_population | Different transport group. |
| expanded-medium-038 | MEDIUM | same_disease_different_location | Different locality. |
| expanded-medium-039 | MEDIUM | related_focus_same_context | Related lifestyle focus. |
| expanded-medium-040 | MEDIUM | related_focus_same_context | Waiting-time measurement and clinic-attendance barriers are distinct but related primary-care access questions. |
| expanded-high-001 | HIGH | exact_duplicate | Exact study intent and context. |
| expanded-high-002 | HIGH | near_duplicate | Near wording with matching study design. |
| expanded-high-003 | HIGH | paraphrase | Equivalent intervention and outcome. |
| expanded-high-004 | HIGH | synonym_substitution | Synonymous reproductive-health wording. |
| expanded-high-005 | HIGH | rephrased_wording | Reordered title with identical intent. |
| expanded-high-006 | HIGH | fragmented_title | Fragmented import title and complete title. |
| expanded-high-007 | HIGH | documentation_difference | Documentation variation describes one idea. |
| expanded-high-008 | HIGH | paraphrase | Low lexical overlap, equivalent intent. |
| expanded-high-009 | HIGH | near_duplicate | Same construct and participants. |
| expanded-high-010 | HIGH | synonym_substitution | Donation/giving synonym pair. |
| expanded-high-011 | HIGH | rephrased_wording | Word order differs only. |
| expanded-high-012 | HIGH | exact_duplicate | Exact duplicate. |
| expanded-high-013 | HIGH | paraphrase | Equivalent service concept. |
| expanded-high-014 | HIGH | fragmented_title | Incomplete title preserves the core intent. |
| expanded-high-015 | HIGH | documentation_difference | Different documentation wording. |
| expanded-high-016 | HIGH | synonym_substitution | Tobacco/cigarette substitution. |
| expanded-high-017 | HIGH | near_duplicate | Same therapy behavior. |
| expanded-high-018 | HIGH | paraphrase | Equivalent proposed relationship. |
| expanded-high-019 | HIGH | rephrased_wording | Equivalent awareness question. |
| expanded-high-020 | HIGH | exact_duplicate | Exact duplicate. |
| expanded-high-021 | HIGH | documentation_difference | Same counselling exposure. |
| expanded-high-022 | HIGH | synonym_substitution | Anxiety/worry equivalent. |
| expanded-high-023 | HIGH | fragmented_title | Fragmented import representation. |
| expanded-high-024 | HIGH | paraphrase | Question form is semantically equivalent. |
| expanded-high-025 | HIGH | near_duplicate | Same health education topic. |
| expanded-high-026 | HIGH | rephrased_wording | Same association and cohort. |
| expanded-high-027 | HIGH | synonym_substitution | Mental/psychological counselling equivalent. |
| expanded-high-028 | HIGH | documentation_difference | Different surface wording. |
| expanded-high-029 | HIGH | exact_duplicate | Exact duplicate. |
| expanded-high-030 | HIGH | paraphrase | Equivalent support construct. |
| expanded-high-031 | HIGH | fragmented_title | Incomplete title. |
| expanded-high-032 | HIGH | near_duplicate | Equivalent named method. |
| expanded-high-033 | HIGH | rephrased_wording | Same implementation construct. |
| expanded-high-034 | HIGH | synonym_substitution | Transmission/spread equivalence. |
| expanded-high-035 | HIGH | documentation_difference | Same behavior and cohort. |
| expanded-high-036 | HIGH | paraphrase | Readiness/willingness equivalent. |
| expanded-high-037 | HIGH | near_duplicate | Same road-safety topic. |
| expanded-high-038 | HIGH | fragmented_title | Fragmented form. |
| expanded-high-039 | HIGH | rephrased_wording | Equivalent dietary concern. |
| expanded-high-040 | HIGH | documentation_difference | Missing location on both sides, same intent. |

## Limitations

- Labels remain manually constructed project benchmark decisions.
- Controlled cases cannot represent every real departmental writing style.
- No model score was used to construct, revise, or validate labels.
