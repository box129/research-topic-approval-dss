# Student Submit Topic Implementation Plan

## 1. Student Submit Topic screen/state summary
The Student Submit Topic page is the student-facing workflow for drafting, reviewing, and submitting a research topic. It supports topic entry, similarity checking, risk review, and final confirmation before submission to the review process.

The page includes four essential states:
- **Empty topic entry**: student begins with an empty or initial topic draft
- **Similarity preview - ready to submit**: similarity analysis completed with a low-risk result
- **Similarity warning**: similarity analysis flagged a high-risk or conflicting topic
- **Confirm submission**: final review and declaration before submitting the topic

## 2. v1.0 implementation priority
All four states are treated as v1.0 because they are core to the topic submission workflow and illustrate the main student experience:
- entering a topic draft
- checking similarity before submission
- receiving a high-similarity warning and revision guidance
- confirming the final submission

## 3. Component breakdown
Suggested reusable components:
- `StudentDashboardLayout`
- `PageHeader`
- `TopicSubmissionForm`
- `TextInput`
- `TextAreaInput`
- `SelectInput`
- `PrimaryButton`
- `SecondaryButton`
- `ValidationMessage`
- `SimilarityPreviewPanel`
- `SubmissionConfirmationPanel`
- `InfoCallout`
- `StatusBadge`
- `RiskBadge`

These components should be designed to support form entry, similarity result presentation, warning states, and confirmation flows without duplicating visual patterns.

## 4. Route/state mapping
- `/student/submit-topic` — primary route for the submit topic workflow
- Default state: **Empty topic entry**
- After the student submits content for similarity checking: **Similarity preview - ready to submit** or **Similarity warning**
- Before final submission: **Confirm submission**
- Separate routes are not required for each state unless the existing codebase already uses distinct route-driven states

## 5. Backend/API dependency notes
The page depends on backend and service integration for:
- current student profile
- topic title and submission draft content
- study focus/category if present
- supervisor/lecturer assignment if present
- similarity check endpoint
- combined similarity score
- Jaccard score
- TF-IDF score
- SBERT score
- overall risk level
- top similar historical topics
- final topic submission endpoint

## 6. Visual matching notes
- Preserve a balanced page structure with a strong page header and clear form area
- Use distinct cards or panels for similarity results and warning details
- Keep risk-oriented states visually differentiated with status badges and color cues
- Use supportive info callouts for guidance on what the similarity score means
- Keep the confirmation state focused on summary details and a clear declaration/submit CTA

## 7. Acceptance checklist
- [ ] `/student/submit-topic` renders the Student Submit Topic page
- [ ] Empty topic entry state shows form fields and submission guidance
- [ ] Similarity preview state displays a low-risk similarity score and readiness to submit
- [ ] Similarity warning state displays a high-risk score, conflict details, and revise guidance
- [ ] Confirm submission state shows a final summary and submit declaration
- [ ] Form inputs use consistent field components and validation messaging
- [ ] Similarity preview panel and risk badges are present in result states
- [ ] Backend dependencies are documented for profile, topic data, similarity scores, risk level, and submission endpoint
