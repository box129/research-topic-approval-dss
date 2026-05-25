# Student Check My Topic Implementation Plan

## 1. Student Check My Topic screen/state summary
The Student Check My Topic page is the student-facing workflow for validating a proposed research topic before formal submission. It lets the student enter topic text, select a category, and run a similarity check that returns risk guidance and recommended next steps.

The page includes four essential v1.0 states:
- **Default check form**: initial entry state where the student enters a topic and selects a category before analysis.
- **Low similarity result**: the topic appears safe or acceptable with a low-risk similarity score and a recommendation to proceed.
- **High similarity warning**: the topic is risky and may be too similar to existing topics, showing multiple matching results and guidance to revise.
- **Medium similarity partial analysis**: the topic needs caution or review, and the results indicate partial or degraded analysis with a cautionary recommendation.

## 2. v1.0 implementation priority
All four states are essential for demonstrating the similarity-check workflow before topic submission. They should be implemented together in v1.0 because they represent the primary student journey from entering a topic through receiving risk guidance.

Priority order:
1. Default check form
2. Low similarity result
3. High similarity warning
4. Medium similarity partial analysis

## 3. Component breakdown
Suggested reusable components for this page:
- `StudentDashboardLayout`
- `PageHeader`
- `TopicCheckForm`
- `TextInput`
- `TextAreaInput`
- `PrimaryButton`
- `SecondaryButton`
- `SimilarityResultPanel`
- `SimilarityScoreBreakdown`
- `SimilarTopicCard`
- `RiskBadge`
- `StatusBadge`
- `InfoCallout`
- `ValidationMessage`
- `EmptyStatePanel`
- `LoadingStatePanel`

Component usage notes:
- `TopicCheckForm` should handle topic text entry, category selection, validation hints, and the submit-for-analysis action.
- `SimilarityResultPanel` should display score details, risk feedback, and the matching topic summary cards.
- `SimilarityScoreBreakdown` should expose combined similarity metrics and score components.
- `SimilarTopicCard` should display each high/medium similarity match and associated details.
- `RiskBadge` and `StatusBadge` should surface low/medium/high risk levels consistently.
- `InfoCallout` should provide guidance on what the similarity score means and when to revise.

## 4. Route/state mapping
- Route: `/student/check-topic`
- Default check form is the initial route state.
- Result states are controlled by the similarity-check API response; the page can remain on the same route while rendering different panels.
- No separate route is required for low, medium, or high result states unless the existing codebase already uses route-driven results.

State mapping:
- `/student/check-topic` → initial default check form
- `/student/check-topic` + success response with low risk → low similarity result
- `/student/check-topic` + success response with high risk → high similarity warning
- `/student/check-topic` + partial or degraded response → medium similarity partial analysis

## 5. Backend/API dependency notes
This page depends on backend and similarity service data for:
- current student profile (if needed for personalization or permission validation)
- topic title or topic text input
- selected topic category
- similarity check endpoint request payload
- combined similarity score
- Jaccard score
- TF-IDF score
- SBERT score
- overall risk level
- top similar historical topics
- recommendation or decision support message

Additional API considerations:
- The similarity endpoint should return a status indicating whether the semantic analysis completed fully or partially.
- The response should include the scores needed to build a combined similarity result and support low/medium/high risk messaging.
- The page may need a separate submit endpoint for proceeding from a low similarity result into the formal submission workflow.

## 6. Visual matching notes
- Maintain a clean, student-facing layout with a clearly labeled page header and form area.
- Use a large topic text area and category selector in the default state, with validation and word count cues.
- Differentiate result states with color-coded panels and badges: green for low risk, yellow for medium/caution, red for high risk.
- Show matching topic cards in result states to make similarity feedback tangible.
- Surface a prominent action CTA in each result state: proceed/submit for low risk, revise for high risk, and caution guidance for medium risk.
- Use callouts to explain the meaning of the score and whether the topic is safe to submit.

## 7. Acceptance checklist
- [ ] New page route `/student/check-topic` is defined.
- [ ] Default check form state renders correctly with topic entry, category selection, validation hints, and an analysis CTA.
- [ ] Low similarity result state renders a low-risk score panel, similar topic match card, and a positive recommendation.
- [ ] High similarity warning state renders a high-risk score panel, multiple matching topic cards, warning guidance, and revise/submit actions.
- [ ] Medium similarity partial analysis state renders a caution panel, partial match details, and a warning that analysis is incomplete.
- [ ] Reusable components are identified and structured consistently across all states.
- [ ] Result states are driven by the similarity-check API response, not by separate routes.
- [ ] Backend dependencies include topic text, similarity scores, risk level, top matches, and recommendation messaging.
- [ ] Visual states are distinguishable by color and risk-level badges.
- [ ] The page supports a student-facing workflow from topic entry through similarity review without implementing final submission UI yet.
