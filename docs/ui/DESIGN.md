# Institutional Evidence Workflow Design Contract

## 1. Purpose

This document governs visual, responsive, and interaction work for the Research Topic Approval DSS frontend. It is enforceable for new screens, redesigns, component changes, and structural frontend refactors.

Figma files or other explicitly approved target screens are the visual source of truth. Existing React Router routes, API contracts, cookie-based authentication, role guards, business rules, persisted behavior, accessible names, and tests are the functional source of truth. When the two sources appear to conflict, stop and resolve the conflict rather than silently changing behavior.

Visual work must not invent data, workflow stages, permissions, system capabilities, or backend behavior. Current screenshots are evidence of the pre-revamp state; they are not approved redesign targets.

## 2. Design Identity

The design system is named **Institutional Evidence Workflow**.

> A compact university operations interface that presents academic evidence formally and guides users clearly through consequential workflows.

The product must feel institutional, trustworthy, academically appropriate, evidence-led, operationally clear, restrained, and accessible. It must not resemble a generic startup SaaS dashboard, commercial analytics platform, cryptocurrency product, social-media application, decorative portfolio, or concept design whose visual ambition weakens workflow clarity.

## 3. Direction Composition

Institutional Evidence Workflow combines three bounded layers:

- **Global Operational — Compact Institutional Console:** governs the authenticated shell, navigation, dashboards, queues, lists, tables, filters, directories, repositories, audit logs, reports, settings, and common loading or empty foundations.
- **Guided Workflow:** governs genuine multi-stage or consequential sequences, including student topic checking, lecturer similarity checking, lecturer submission review, supervisee assignment, imports, and topic submission where staging improves understanding.
- **Academic Record:** selectively governs submission summaries, research-topic records, evidence, stored snapshots, decision history, lecturer rationale, formal decisions, and future printable or exportable records.

These are not three independent visual systems. All layers share the same tokens, spacing rhythm, control language, accessibility rules, responsive breakpoints, and status semantics. The workflow layer changes composition and disclosure, not branding. The academic layer may introduce restrained system-serif headings and document-like rules, but navigation, controls, tables, filters, metadata, and operational headings remain sans-serif.

Do not add steppers to ordinary single-task pages.

## 4. Public and Marketing-Style Surfaces

### Public-page exception to operational compactness

Compactness remains the default for authenticated operational pages. The public landing page is a deliberate exception: it may be longer, more explanatory, and more visually varied when that depth helps a prospective user understand the platform accurately.

- Every major landing section must communicate a distinct platform idea.
- Information depth must not become repeated filler or unsupported marketing.
- Explain the system, its users, evidence, and approval workflow before its infrastructure.
- Technical architecture must not dominate the first viewport.
- Strong editorial headings and selected system-serif treatment are permitted.
- Authenticated pages must not inherit oversized public-page hero patterns by default.
- Alternating tonal sections, limited role columns, diagrams, and structured comparisons are allowed when factual and accessible.
- The public exception does not weaken the anti-card, disclosure, token, data-honesty, or accessibility rules in this contract.

### Public-page content hierarchy

The first viewport must answer:

1. What problem does the platform solve?
2. Who is it for?
3. What happens when it is used?
4. Where does the user sign in?

The public page may then explain why the platform exists, role journeys, similarity approaches, the approval workflow, repository lifecycle records, evidence versus academic judgement, governance and traceability, and technical foundations.

### Public navigation

Landing navigation may use page anchors such as **Why it exists**, **Who it supports**, **Similarity evidence**, **How approval works**, **Governance**, and **Sign in**. It must not expose public links labelled **Dashboard**, **Submissions**, **Analytics**, **Library**, or **Archive** unless those destinations are genuinely public and implemented. The public masthead must not mimic authenticated role navigation.

### Landing-page truthfulness

- Label illustrative workflows and diagrams as illustrative.
- Label static architecture information as **staging configuration** or **technical architecture**.
- Do not present an operational status badge as live unless it is sourced from a runtime readiness endpoint and its freshness is clear.
- Do not present an example percentage, score, record, user, or status as actual evidence.
- Do not claim departmental trust, adoption, endorsement, approval, accreditation, or production readiness without verified support.
- Do not require readiness API integration solely to make a design appear operational; such integration requires separate approval.

### Information breadth without repetition

- Role sections explain outcomes and responsibilities rather than merely listing route names.
- Technical sections explain system structure and do not repeat workflow sections.
- The staging disclosure appears once clearly.
- The final sign-in CTA does not repeat the entire hero.
- Every section has a distinct purpose and earns its place in the reading order.
- A substantive page may remain long on mobile, but Sign In must remain reachable near the top and repeated content must be removed.

## 5. Information Hierarchy

- Render exactly one visible `h1` per page.
- Give each page one dominant workflow or task.
- Make the primary action visibly distinct from secondary and tertiary actions.
- Do not let supporting information compete with the primary workflow.
- State a technical boundary once, where it materially affects user expectations.
- Do not let unavailable features dominate a page.
- Keep consequential actions visibly distinct from ordinary navigation and secondary actions.
- Position evidence near the decision or action it informs.
- Use heading levels in document order; do not use heading styling to compensate for incorrect semantics.
- Prefer progressive disclosure for supplementary detail, never for information required to make a safe decision.

## 6. Typography

- Use sans-serif for navigation, forms, buttons, tables, filters, metadata, dashboards, operational records, and operational headings.
- A restrained system-serif may be used only for selected academic-record and formal-review headings.
- Do not introduce a font package or external font dependency without explicit approval.
- Body and control text must meet the approved accessible minimum; 16px is the default body size and 14px is the minimum for secondary operational text. Smaller text requires a documented exceptional use and must remain legible.
- Avoid pervasive tiny uppercase text. Use uppercase only for short, meaningful categories or identifiers.
- Use sentence case for ordinary labels.
- Limit wide letter spacing, especially below 14px.
- Keep long rationale and evidence text to a readable measure, normally 60–80 characters per line.
- Use tabular numerals where aligned counts, scores, dates, or operational comparisons benefit.

## 7. Colour

- Institutional green identifies navigation and permitted primary actions.
- Gold identifies revision, attention, or a limited institutional accent.
- Blue identifies advisory evidence and neutral information.
- Red is reserved for rejected, destructive, failed, or dangerous states.
- Neutral surfaces form the main workspace.
- Colour must never be the only status indicator; pair it with clear text and, where useful, a restrained icon or marker.
- Use semantic tokens from `frontend/src/index.css`. Do not add arbitrary literal colour values outside the approved token system.
- Do not use decorative gradients. A gradient requires a documented functional purpose and approval.
- Static architecture claims must not borrow live-health colours or treatments.

## 8. Density and Spacing

Density is adaptive:

- Compact for directories, queues, tables, dashboards, and operational records.
- Medium for student forms.
- Medium for lecturer evidence and decisions.
- Slightly more spacious for formal academic records.

Use the spacing rhythm `4, 8, 12, 16, 24, 32, 48`. Exceptions must be deliberate and reusable.

- Interactive controls must have a minimum usable height of 44px on touch layouts; dense desktop controls may use 40px when focus and hit targets remain clear.
- Reduce unnecessary vertical stacking and repeated introductory content.
- Use compact mobile summaries for long records.
- Do not add decorative whitespace that delays or hides functional information.
- Avoid more than two nested surface levels.

## 9. Navigation

### Desktop

- Provide persistent role-aware navigation.
- Group routes by task category rather than presenting one uninterrupted horizontal list.
- Keep every authorized route directly reachable.
- Keep the current location obvious through text and a non-colour-only active treatment.

Suggested groups:

- **Student:** Overview; Topic Work; Records.
- **Lecturer:** Review Work; Similarity Tools; Records.
- **Administrator:** Overview; People; Research Records; Governance.

### Tablet

- Use collapsible navigation with clear text labels.
- Preserve stable page identity and access to page actions.
- Do not rely on icon recognition alone.

### Mobile

- Do not use a horizontally clipped global route strip.
- Use a clear role menu or drawer.
- Do not obscure actions or route names with navigation controls.
- Keep the current page identifiable after the menu closes.
- Route access must not depend on discovering hidden horizontal scrolling.
- Preserve keyboard operation, focus management, and an accessible menu name.

The contract does not prescribe the final navigation component implementation before representative designs are approved.

## 10. Cards and Surfaces

- Do not place every section inside a card.
- Use a card only for independently actionable, status-bearing, or meaningfully grouped content.
- Prefer sections, dividers, tables, definition lists, and record rows for ordinary content.
- Do not exceed two nested surface levels.
- Give primary work, supporting information, disclosures, warnings, and empty states different visual weights.
- Large hero surfaces are not the default for authenticated operational pages.
- Radius and shadow must come from approved tokens; do not create page-specific decorative surface systems.

## 11. Forms

- Keep labels visible; placeholders do not replace labels.
- Place validation beside the relevant field and associate it programmatically.
- Keep helper text concise and remove repeated explanations.
- Keep form actions close to the final input.
- Do not change payloads, validation, submission behavior, or API mapping for visual reasons.
- Show rationale requirements before consequential decisions are initiated.
- On mobile, put the task before promotional, architectural, or lengthy explanatory content.
- Preserve disabled, loading, error, and success states.

## 12. Tables and Records

- Use desktop tables for high-density operational data where comparison matters.
- Keep row actions compact, explicit, and keyboard accessible.
- Establish a clear column hierarchy and avoid giving every value equal prominence.
- By default, transform mobile tables into intentionally designed expandable records.
- Initially show the primary identifier, status, most relevant owner or date, and primary action.
- Place secondary metadata in an accessible disclosure.
- A horizontally scrollable mobile table is exceptional and requires evidence that cross-column comparison is essential.
- Preserve real-data-only rendering, pagination, sorting, filters, and empty/error behavior.

## 13. Workflow Stages

Visible stages are appropriate only when a real sequence exists. Approved examples include:

- Enter topic → review input → view advisory result.
- Review submission → inspect evidence → record decision.
- Select assignment participants → review → confirm.
- Upload import → preview → commit.

Do not add a stepper to dashboards, simple filters, read-only reports, or single-action forms. Completed stages may collapse into accessible summaries, but users must be able to reopen them. Stage presentation must reflect real system state and must not imply persisted progress that the backend does not store.

## 14. Academic Records and Formal Decisions

- Submission records may use restrained system-serif headings.
- Clearly separate evidence from reviewer opinion or rationale.
- Keep similarity methodology secondary to the result and recommendation.
- Present lecturer decisions in a formal review panel.
- Where supported, show current status, evidence summary, proposed decision, rationale, reviewer identity, and confirmation action.
- Keep decision history factual and sourced from stored records.
- Do not imply signatures, approvals, reviewer identities, or decision authority unsupported by the backend.
- Preserve the distinction between advisory similarity and lecturer-controlled decisions.

## 15. Statuses, Badges, and Risk

- Preserve every existing semantic status mapping and submission status value.
- Preserve LOW, MEDIUM, and HIGH meanings and thresholds.
- Avoid excessive pill badges.
- Prefer status text with a restrained colour, icon, or marker.
- Do not show several badges when one status statement is sufficient.
- Never present advisory evidence as an automatic approval, rejection, or block.
- Ensure statuses remain understandable without colour.

## 16. Loading, Empty, Error, and Unavailable States

### Loading

- Match expected final geometry where practical.
- Use row, record, form, or stage skeletons rather than oversized generic loading panels.
- Announce loading meaningfully to assistive technology.

### Empty

- Keep the state compact and place it where content would appear.
- State the condition clearly.
- Show an action only when a valid action exists.
- Do not show several zero-value metric cards and a second large empty panel for the same absence.

### Error

- Place the error at the failed section where possible.
- Preserve successful page content.
- Provide Retry when supported.
- Do not substitute fabricated fallback records.

### Unavailable

- State the limitation once.
- Do not construct a large fake interface around an unavailable feature.
- Do not fabricate charts, metrics, activity, or records.

## 17. Disclosures and Technical Boundaries

- Use one concise staging notice on public surfaces.
- Use one advisory statement near similarity results.
- Use one consequential warning near decisions.
- Place methodology and technical detail behind an accessible disclosure when it is supplementary.
- Remove repeated “no fake data,” “nothing saved,” “read-only,” “not connected,” and “deferred” banners when the same boundary is already clear.
- Never hide a limitation that materially changes the user’s decision.
- Disclosure triggers must expose state, support keyboard activation, and remain understandable when expanded or collapsed.

## 18. Consequential Actions

- Clearly differentiate reject, suspend, purge, commit-import, status-change, and assignment-change actions.
- Present rationale requirements before the action.
- Preserve confirmation behavior and exact payload semantics.
- Do not style destructive actions like ordinary secondary controls.
- Keep action labels explicit about their consequence.
- Ensure mobile users can reach consequential actions without excessive unrelated scrolling.
- Preserve disabled actions for finalized records and current-user protections.

## 19. Data Honesty

Do not introduce fabricated users, topics, metrics, activity, approvals, similarity results, charts, production-readiness claims, or departmental-approval claims. Do not label a service “Live,” “Healthy,” or “Available” unless the state comes from runtime data and its freshness is clear.

Static architecture content must be labelled **illustrative** or **staging configuration**. A static environment list must not resemble a live health monitor.

## 20. Accessibility

- Support complete keyboard access and logical focus order.
- Use visible focus states that meet contrast requirements.
- Maintain meaningful heading order and exactly one visible `h1` per page.
- Use readable text sizes and controlled line lengths.
- Never rely on colour alone.
- Make disclosures accessible and announce expanded state.
- Preserve labels, accessible names, test IDs, and landmark semantics unless an explicit migration is approved.
- Ensure mobile controls are visible and reachable.
- Do not create pointer-only navigation, workflow, tooltips, or row actions.
- Manage focus in drawers and confirmation dialogs.

## 21. Responsive Design

Required evidence viewports are:

- `1440 × 1000`
- `1280 × 800`
- `768 × 1024`
- `390 × 844`

At every viewport:

- No document-level horizontal overflow.
- No obscured navigation labels.
- No clipped consequential actions.
- No zero-sized visible controls.
- Long records use deliberate mobile summaries or accessible disclosure.
- Primary tasks appear early in the mobile reading order.
- Text wrapping must not obscure status, identity, or action meaning.

## 22. Anti-Patterns

The following are prohibited:

- A card around every section.
- Excessive pill-shaped badges.
- Decorative gradients.
- Tiny uppercase text throughout.
- Fake charts or fabricated statistics.
- Static health claims presented as live.
- Generic three-column marketing grids.
- Decorative animation.
- Excessive explanatory text.
- Hidden horizontal mobile navigation.
- Arbitrary new colours.
- Unsupported functionality.
- Generic “modern SaaS dashboard” styling.
- Decorative whitespace that displaces real workflow information.
- Replacing evidence with visual spectacle.
- Unrelated page changes during a scoped visual task.

## 23. Agent Implementation Rules

Future agents must:

1. Read this document, `COMPONENT-MAP.md`, `REPRESENTATIVE-SCREEN-BRIEFS.md`, and `VISUAL-ACCEPTANCE-CRITERIA.md` before visual or structural frontend work.
2. Inspect broadly and modify narrowly.
3. Name allowed files and forbidden files before implementation.
4. Preserve API contracts, routes, authentication, role guards, cookies, business rules, and persisted behavior.
5. Preserve test IDs and accessible labels unless an explicit migration includes corresponding tests and approval.
6. Reuse existing components and tokens before adding variants or replacements.
7. Avoid new packages, external fonts, or dependencies without approval.
8. Keep scoring, thresholds, risk meanings, response mapping, and advisory behavior unchanged.
9. Run frontend lint, the complete frontend test suite, the production build, focused tests, and relevant Playwright evidence.
10. Return desktop and mobile screenshots at approved viewports.
11. Review console errors, network failures, overflow, focus behavior, empty/error/loading states, and consequential actions.
12. Report remaining visual differences and limitations honestly.
