# Institutional Evidence Workflow Representative-Screen Briefs

These briefs define target composition and acceptance boundaries. They do not authorize implementation and are not substitutes for approved Figma or equivalent target screens. The archived screenshots document the pre-revamp state only.

## 1. Landing Page

### Purpose

Explain why the platform exists, how its three roles use it, how similarity evidence is produced, and how a proposed topic becomes a lecturer-controlled decision. The page must build accurate understanding before taking an authorized user to Sign In.

### Selected design layers

- **Public Editorial:** long-form platform storytelling, selected system-serif headings, alternating tonal sections, and factual explanatory visuals.
- **Global Institutional:** masthead, responsive foundation, page anchors, Sign In actions, tokens, accessibility, and staging honesty.
- **Guided Workflow:** the real Topic Submission → Similarity Checking → Lecturer Review → Decision Record sequence.
- **Academic Record:** evidence, repository lifecycle, rationale, and decision distinctions where they are explained.

### Current problems

At both 1440×1000 and 390×844, the current landing page uses two large hero surfaces, a static “Live staging chain,” four availability badges, role cards, a repeated four-step workflow, and a separate staging notice. On mobile these stack into a very long page. Static environment configuration visually resembles live health monitoring, and role/workflow explanations repeat similar information.

The redesign must not solve this by becoming an overly minimal entry page. The current page lacks substantive explanation of the problem, similarity approaches, repository lifecycle, evidence-versus-decision boundary, supported governance, and the role-specific journeys.

### Approved information architecture

#### 1. Institutional masthead

- Preserve the **Research Topic Approval DSS** identity.
- Show one concise staging/demo badge.
- Provide page anchors such as Why it exists, Who it supports, Similarity evidence, How approval works, and Governance.
- Provide one primary **Sign In** action.
- Do not mimic authenticated role navigation or expose unsupported public application routes.

#### 2. Editorial hero

- Use a confident, value-led headline and concise system explanation.
- Provide a primary Sign In action and secondary **See how the process works** anchor action.
- Include one substantial but clearly illustrative evidence or approval-workflow visual.
- The recommended message is: “A role-based decision-support system that compares proposed undergraduate research topics with existing records using lexical and semantic similarity while keeping final approval under lecturer control.” Final copy remains subject to target-screen approval.
- The illustration must not contain fabricated scores, records, users, statuses, metrics, or live-health claims.

#### 3. Why the platform exists

Explain that the system is **designed to support** challenges such as reliance on stored topic titles, keyword-only comparison, identifying synonyms and paraphrases, repetition across academic sessions, and the need for traceable supporting evidence. Do not claim these problems have already been solved department-wide.

#### 4. Who the platform supports

Role sections must describe real outcomes rather than route names:

- **Student:** privately pre-check an idea, submit a topic, track review status, and view lecturer rationale and outcomes.
- **Lecturer:** open assigned submissions, inspect topic information, run or review similarity evidence, inspect supported saved snapshots, approve/reject/request revision with rationale, and review previous decisions.
- **Administrator:** inspect user accounts; manage supported account-status and supervisee-assignment workflows; maintain supported topic repositories; preview and commit authorized imports; inspect audit records; and access supported aggregate summaries and CSV exports.

Do not promise unrestricted user lifecycle management, unrestricted settings changes, or advanced analytics.

#### 5. How similarity evidence is produced

Explain the implemented approaches in accessible language:

- **Jaccard similarity:** compares overlap between normalized sets of topic terms.
- **TF-IDF with cosine similarity:** gives greater weight to terms that are informative across the repository, then compares weighted topic vectors.
- **SBERT semantic similarity:** compares sentence-level meaning so related wording, synonyms, and paraphrases can be identified beyond exact term overlap.

State that the methods provide lexical and semantic evidence, results remain advisory, and similarity never automatically approves or rejects a topic. Deeper scoring detail may sit behind an accessible disclosure. Do not present the system as unexplained “advanced AI.”

#### 6. From proposal to decision

Use the real four-stage flow:

1. Topic Submission.
2. Similarity Checking.
3. Lecturer Review.
4. Decision Record.

Show revision as a possible lecturer outcome where appropriate. Emphasize: **Similarity evidence supports the decision. It does not make the decision.**

#### 7. Structured topic repository

Explain that comparison may use historical topics, current-session topics, and under-review topics. Explain that recorded metadata may include title, academic session, category, keywords, supervisor where available, population, location, study-focus context, and lifecycle status. Do not imply that every record is complete or promise a public archive explorer.

#### 8. Evidence and academic judgement

Use a structured comparison:

- **Similarity evidence:** produced by the checking workflow, identifies related records, combines lexical and semantic approaches, and may be saved in supported lecturer snapshots.
- **Academic decision:** made by an authorized lecturer, considers the proposal and academic context, may approve/reject/request revision, and records rationale where required.

This section must prevent the platform from being mistaken for an automatic plagiarism or approval engine.

#### 9. Governance and traceability

Describe only supported capabilities: role-protected access, user status management, lecturer–student assignment records, repository import preview and commit, audit records, guarded audit-purge workflow, aggregate administrative summaries, and supported CSV exports.

Do not claim institutional certification, accreditation reporting, immutable originality certificates, comprehensive research analytics, or verified production monitoring.

#### 10. Technical foundation

Place technical structure below the product, role, evidence, and workflow explanations. It may accurately describe the React frontend, Node.js/Express backend, PostgreSQL with Prisma, Python/FastAPI semantic service, and role-protected workflows.

Use a compact architecture diagram or accessible **View technical architecture** disclosure. Label static information as technical architecture or staging configuration. Do not use static green availability indicators or imply live monitoring.

#### 11. Final sign-in call to action

- Use a clear sign-in heading.
- Explain concisely that authenticated users are routed according to their assigned role.
- Provide one primary Sign In action.
- Include one concise staging disclosure.
- Do not imply self-registration.

### Landing-page visual direction

The approved target may use a two-column hero, alternating cream/white/deep-green sections, selected editorial headings, one visually rich but factual illustration, limited role cards or columns, diagrams, structured comparisons, and a strong closing CTA.

It must avoid black startup styling, neon glow, glassmorphism, excessive gradients, card-per-paragraph composition, fake dashboard screenshots, and long runs of identical feature cards. Authenticated pages must not inherit its hero scale.

### Desktop target composition — 1440 × 1000

The first viewport must show the institutional masthead, hero value proposition, primary and secondary actions, and a substantial but clearly illustrative workflow/evidence visual. It must answer what problem is addressed, who the platform supports, what happens when it is used, and where to sign in.

Below the first viewport, use the approved information architecture in a deliberate editorial rhythm. Sections may alternate tonal backgrounds and compositions, but each must communicate a different platform idea. Technical architecture must not occupy the hero’s dominant position.

### Mobile target composition — 390 × 844

- Keep Sign In reachable near the top.
- Do not let the headline and introduction consume the entire first screen.
- Simplify the illustrative hero visual rather than reproducing the full desktop composition.
- Collapse page anchors into an accessible menu where necessary.
- Stack sections with concise copy and distinct purpose.
- A long-form page may remain long, but repeated role, workflow, infrastructure, and staging content must be removed.
- Place technical architecture after the platform and workflow explanation, preferably behind disclosure.

### Hierarchy

- `h1`: “Research Topic Approval DSS.”
- Primary action: “Sign In” or the approved accessible equivalent.
- Secondary action: “See how the process works.”
- Supporting information: problem context, role journeys, methods, workflow, repository, evidence/judgement, and governance.
- Disclosure: methodology depth, staging configuration, and technical architecture as appropriate.
- Consequential actions: none.
- Secondary details: provider/framework names and deeper scoring explanation.

### Existing components to reuse

- `PublicAuthRoute` behavior around `/login`.
- Existing route links and public masthead identity.
- Semantic tokens from `frontend/src/index.css`.
- `PrimaryButton` where compatible with link semantics.
- Accessible disclosure and heading patterns after they are approved.

### Components requiring consolidation or refactoring

- `frontend/src/pages/LandingPage.jsx` composition.
- Public masthead and page-anchor behavior.
- Repeated role/workflow card patterns.
- Static availability rows and badges.
- Public header and auth-layout identity treatment.
- New conceptual section responsibilities listed in `COMPONENT-MAP.md`; these do not require one component per section.

### Functional behavior to preserve

- Route `/` remains public.
- Sign In actions continue to `/login`.
- Authenticated-user routing behavior remains governed by existing auth/routes.
- Existing accessible service heading and Sign In action remain discoverable.
- No API calls or runtime claims are added solely for presentation.
- Loading/auth-check behavior remains unchanged where applicable.
- Page anchors, if approved, move focus/viewport predictably without changing application routes.

### Required states

- Default desktop.
- Default mobile.
- Navigation-expanded mobile.
- Long-copy and long-heading resilience.
- Reduced-motion compatibility where relevant.
- Missing or unavailable architecture detail.
- Staging/technical disclosure expanded and collapsed where introduced.
- No-JavaScript or API-unavailable behavior only if the final approved design depends on runtime readiness data. Readiness integration is not required by this brief.

### Forbidden content

- Product renaming or standalone generated HTML.
- CDN Tailwind or new external font/icon dependencies.
- Black/neon startup styling, glassmorphism, oversized decorative typography, glowing forms, or decorative animation.
- Fake topic records, users, percentages, similarity scores, accuracy rates, activity, charts, or dashboards.
- “System Online,” “Live,” “Healthy,” or “Available” indicators not sourced from runtime data.
- Unsupported archive search, research-gap detection, citation mapping, PDF/certification promises, or comprehensive analytics.
- Accreditation, departmental endorsement/adoption, public-production, or official-platform claims without verified support.
- Public links to authenticated or unsupported pages.
- Self-registration promises, unrestricted account management, unrestricted settings changes, or unsupported exports.
- Any example result presented as actual evidence rather than explicitly labelled illustration.

### Acceptance notes

A future target is acceptable only when it provides substantially more useful platform information than the current landing page while remaining factual. The first viewport must explain product value before infrastructure; all three roles and the four-stage workflow must be understandable; Jaccard, TF-IDF/cosine, and SBERT must be described accurately; lecturer control must be unmistakable; and mobile Sign In must not be buried.

It is unacceptable if it contains a fake metric, result, record, endorsement, live-status presentation, unsupported feature, repeated filler, infrastructure-first storytelling, excessive cards, or inaccessible/hidden mobile Sign In.

## 2. Student Check My Topic

### Purpose

Let a student enter a proposed topic and optional context, receive advisory LOW/MEDIUM/HIGH similarity guidance, inspect matched real records, and understand that the check does not submit or decide the topic.

### Selected design layers

- **Global Operational:** authenticated shell, role navigation, form controls, loading/error foundations.
- **Guided Workflow:** Enter topic → review valid input → view advisory result.
- **Academic Record:** similarity finding, recommendation, matched-topic evidence, and technical methodology.

### Current problems

The 1440×1000 screen uses a page introduction, separate “Pre-check only” banner, large private-checker card, nested form heading, “Nothing saved” badge, validation benchmark callout, and oversized empty-result panel. The 390×844 screen adds clipped horizontal global navigation and stacks all explanations before the result. The same non-persistence/advisory boundary appears several times.

### Desktop target composition — 1440 × 1000

1. Compact page header with one `h1` and one concise advisory statement.
2. Primary workflow surface with topic form and reserved result area; avoid multiple introductory headings.
3. Stage 1 form: topic, research area, keywords, field validation, and Check Similarity action.
4. Before submission, show only a compact “No result yet” state.
5. During submission, preserve form context and show geometry-matched result loading.
6. After success, collapse the completed form to a readable topic summary or keep it compact above the result.
7. Result hierarchy: risk and maximum similarity; backend recommendation; matched records by tier; methodology disclosure last.

### Mobile target composition — 390 × 844

1. Role-menu navigation replaces the clipped route strip.
2. Page task and concise advisory statement appear first.
3. Form occupies the initial workflow stage without promotional callouts.
4. On success, transition emphasis from form to result; the completed input may collapse to a summary with “Edit” or “Check another topic.”
5. Show risk, recommendation, and top matches before technical detail.
6. Technical algorithm scores remain collapsed behind an accessible disclosure.

### Hierarchy

- `h1`: “Check My Topic.”
- Primary action: “Check Similarity”; after success, “Check Another Topic” as the reset action.
- Supporting information: word requirements and optional category/keyword guidance beside their fields.
- Disclosure: one advisory statement; technical methodology behind disclosure.
- Consequential actions: none; this workflow is explicitly non-decisional.
- Secondary details: individual algorithm scores and supplementary match metadata.

### Existing components to reuse

- `TopicForm` behavior and test IDs.
- `ResultsDisplay` behavior and semantic mappings.
- `RiskBadge`, `StatusBadge` where currently required.
- Shared form inputs, `PrimaryButton`, `LoadingStatePanel`, `EmptyStatePanel`, and `InfoCallout` behavior.
- `AppLayout`/role guard behavior pending shell refactor.

### Components requiring consolidation or refactoring

- `frontend/src/pages/student/CheckMyTopicPage.jsx` composition.
- `AuthenticatedTopNav` mobile behavior.
- Empty/loading state sizing.
- Boundary callouts.
- `ResultsDisplay` presentation only after behavior parity is mapped.

### Functional behavior to preserve

- Route `/student/check-my-topic` and student role guard.
- Existing similarity endpoint and exact `TopicForm` payload.
- 7–24-word validation, optional category and keywords, counters, disabled/loading behavior.
- LOW/MEDIUM/HIGH semantics, maximum similarity, recommendation, tier mapping, and real matches.
- Success, empty, API error, server/network error, reset, SBERT-unavailable, and partial-success states.
- No submission, lecturer-decision, snapshot, or status mutation from this page.

### Required states

- Default empty form.
- Invalid input and long validation text.
- Valid/ready form.
- Disabled and checking states.
- LOW, MEDIUM, and HIGH populated results.
- No matches.
- Degraded/partial success with SBERT unavailable.
- API and network error.
- Long topic/match titles.
- Mobile form and mobile populated result.

### Forbidden content

- Automatic approval/rejection language.
- Fake matches, scores, recommendations, or persistence.
- Claims that the check submits a topic or saves a decision.
- New score thresholds or risk interpretation.

### Acceptance notes

Acceptable mockups preserve every tested form and result state, state the advisory boundary once, and make result evidence easier to scan than methodology. They are unacceptable if the form payload changes, technical scores become the primary finding, the result implies a decision, or mobile users must traverse repeated callouts before seeing their result.

## 3. Lecturer Submission Details

### Purpose

Enable an authorized lecturer to review a submitted topic, inspect stored and current similarity evidence, provide required rationale where applicable, and confirm a formal lecturer-controlled decision.

### Selected design layers

- **Global Operational:** shell, route context, loading/error foundations, back navigation.
- **Guided Workflow:** Review submission → inspect/run evidence → record decision.
- **Academic Record:** submission summary, student/topic metadata, snapshots, current evidence, rationale, status, decision history, and formal decision panel.

### Current problems

At 1440×1000 the screen is logically ordered but uses many large rounded surfaces and metadata cards. Snapshot history, current check, rationale, and decision actions span a long page. At 390×844, submission metadata alone occupies several viewports; evidence and decision controls are separated by extensive scrolling. Boundary statements repeat that evidence is advisory and decisions remain lecturer-controlled.

### Desktop target composition — 1440 × 1000

1. Compact header with one `h1`, status, topic title, and Back to Pending Reviews.
2. Stage navigation or section index reflecting the real three-stage workflow.
3. Submission stage: academic-record summary with topic, student, session, category, keywords, submitted date, and current status in a definition grid—not isolated metric cards.
4. Evidence stage: latest stored snapshot summary and Run Similarity Check in the same working region; history is a compact table/list.
5. Current result uses `ResultsDisplay` behavior with formal evidence styling and collapsed methodology.
6. Decision stage: persistent side panel or closely adjacent final section containing evidence summary, rationale, actions, and current/final status.
7. Confirmation modal summarizes the exact proposed action and rationale.

### Mobile target composition — 390 × 844

1. Compact topic/status summary and Back action.
2. Completed submission metadata collapses into an accessible summary showing essential fields first.
3. Evidence stage presents latest snapshot or “none,” Run Check, and current result together.
4. Historical snapshots are collapsed by default but remain reachable.
5. A clear “Record decision” entry point moves users to the formal panel without unrelated scrolling.
6. Rationale appears before Revision or Reject; finalized records show disabled actions and decision history.
7. No sticky action may cover fields, evidence, or confirmation controls.

### Hierarchy

- `h1`: “Submission Details.”
- Primary action by stage: Run Similarity Check in Evidence; selected lecturer decision in Decision.
- Supporting information: student/topic metadata and snapshot history.
- Disclosure: methodology and repeated historical detail.
- Consequential actions: Approve, Request Revision, Reject, with Reject/destructive semantics clearly differentiated.
- Secondary details: algorithm scores, audit-friendly timestamps, reviewer metadata.

### Existing components to reuse

- `ResultsDisplay` behavior.
- `ConfirmActionModal`.
- `StatusBadge`, `RiskBadge`.
- Shared loading/empty/error behavior and buttons.
- Existing route, API helpers, response mapping, and protected layout.

### Components requiring consolidation or refactoring

- `frontend/src/pages/lecturer/SubmissionDetailPage.jsx` composition.
- Metadata cards and repeated callouts.
- Snapshot list/history presentation.
- Evidence/result composition.
- Authenticated mobile navigation.

### Functional behavior to preserve

- Route `/lecturer/pending-reviews/:topicId` and lecturer guard.
- Submission-detail and snapshot-history API calls with route ID.
- Retry behavior for detail and history failures.
- Lecturer similarity-check payload and history refresh after success.
- LOW/MEDIUM/HIGH, partial success, SBERT warning, and ResultsDisplay behavior.
- Exact decision status payloads.
- Rationale validation and requirements.
- Confirmation before Approve, Request Revision, and Reject.
- Finalized-record disabled actions and stored reviewer/decision information.
- No similarity result automatically changes submission status.

### Required states

- Submission loading and load error with retry.
- Loaded record with incomplete optional metadata.
- No saved snapshots.
- Populated snapshot history and history error/retry.
- Similarity idle, running, success, no matches, error, and partial success.
- Pending decision with empty/valid rationale.
- Approve, Revision, and Reject confirmations.
- Mutation pending/success/error.
- Finalized record with disabled actions.
- Long topic, rationale, recommendation, and match titles.
- Desktop and mobile workflow states.

### Forbidden content

- Automatic decisions or blocking based on similarity.
- Fabricated student fields, snapshots, reviewers, signatures, or dates.
- Unsupported formal-signature language.
- Hidden rationale requirements.
- New decision statuses or altered payloads.

### Acceptance notes

An acceptable mockup visibly separates submitted facts, similarity evidence, and lecturer rationale while keeping evidence and decision controls close. It must support every tested state and confirmation. It is unacceptable if evidence looks like a final decision, history disappears, mobile users must cross several unrelated screens to decide, or finalized records appear editable.

## 4. Admin User Management

### Purpose

Let an administrator find and inspect real user accounts, perform the permitted audited status change, and separately manage real lecturer–supervisee assignments.

### Selected design layers

- **Global Operational:** directory, compact metrics, filters, records, pagination, account status.
- **Guided Workflow:** Select assignment participants → review → confirm; end-assignment confirmation.
- **Academic Record:** limited to factual account/assignment record presentation and audit-relevant dates; no decorative editorial layer.

### Current problems

The desktop baseline presents two visible `h1` headings, a large hero, four metric cards, a boundary callout, assignment creation and empty state, then account filters and records. The mobile baseline stacks all of this into a very long page before users finish scanning three accounts. Repeated “real/no fake/read-only/deferred” messages dominate. Assignment management and directory work compete for primary status.

### Desktop target composition — 1440 × 1000

1. Compact page header with one `h1`, short subtitle, and optional task switcher.
2. Directory-first view by default.
3. One compact summary strip for visible users, students, lecturers, and suspended users—only when values are correctly described as current returned-page counts.
4. Filter bar immediately above a high-density user table.
5. Table columns prioritize user identity, role, status, updated date, and permitted action.
6. Account status confirmation remains explicit and audited.
7. Supervisee Assignments is a distinct task surface, tab, subroute candidate, or clearly separated workflow—not a competing hero section.
8. Assignment empty state is compact and adjacent to the valid Create Assignment action.

### Mobile target composition — 390 × 844

1. Page title and current task first.
2. Compact/collapsible summary metrics.
3. Filters behind a clearly labelled disclosure or compact stacked control group.
4. User records become expandable summaries showing name/email, role, status, relevant date, and status action.
5. Secondary metadata expands on demand.
6. Assignment workflow is entered deliberately and does not precede the directory by default.
7. Create/end assignment confirmations remain reachable and do not depend on horizontal scrolling.

### Hierarchy

- `h1`: “User Management.”
- Primary action: Apply Filters/Search in directory context; Create Assignment in assignment context.
- Supporting information: compact counts, pagination, account metadata.
- Disclosure: narrow capability boundary once, if still required.
- Consequential actions: Suspend/Activate Account, Create Assignment, End Assignment.
- Secondary details: created/updated dates, assignment notes, pagination totals.

### Existing components to reuse

- `PageHeader` after one-heading enforcement.
- Form input/select/search behavior.
- `StatusBadge` semantics.
- `ConfirmActionModal` as a future replacement for native confirmation only after behavior parity is approved.
- `TableShell` as the future desktop/mobile record foundation.
- Loading, empty, error, and callout behavior after consolidation.
- Existing API helpers and auth hook.

### Components requiring consolidation or refactoring

- `frontend/src/pages/admin/UserManagementPage.jsx` page responsibilities and composition.
- Page-local user rows and filters.
- Assignment form/list/empty-state composition.
- `MetricCard`/`StatCard` family.
- Native `window.confirm` behavior only through a separately approved parity migration.
- Authenticated mobile navigation.

### Functional behavior to preserve

- Route `/admin/user-management` and admin role guard.
- User-list API parameters, search/role/status filters, sorting/pagination behavior, and real returned records.
- Exclusion of sensitive fields.
- Current-admin protection and permitted active/suspended status actions.
- Existing status-update API, confirmation, pending, success, and error behavior.
- Assignment/list option APIs and active-only real users.
- Exact create-assignment payload, duplicate/error handling, success message, and list update.
- End-assignment behavior, historical-record preservation, confirmation, pending, success, and error states.
- No fabricated users, relationships, metrics, or last-active values.

### Required states

- Directory loading, populated, filtered empty, error, status mutation pending/success/error, and pagination.
- Long names/emails and mixed roles/statuses.
- Assignment/options loading, no active assignments, populated assignments, options unavailable, create pending/success/error, end pending/success/error.
- Disabled current-admin status action.
- Desktop table and mobile expandable records.
- Consequential confirmations.

### Forbidden content

- Fabricated users, workload, assignments, last-active timestamps, invitations, role changes, resets, or deletion controls.
- Counts presented as system-wide when they are only the returned page.
- Unsupported account-creation workflow.
- Status actions on protected accounts.

### Acceptance notes

Acceptable mockups make the user directory the default task, clearly separate assignments, preserve consequence signalling, and turn mobile records into intentional summaries. They are unacceptable if they retain duplicate page headings, place several metrics and boundary cards before the directory, obscure status actions, combine assignment and user mutations without context, or imply unsupported administration features.
