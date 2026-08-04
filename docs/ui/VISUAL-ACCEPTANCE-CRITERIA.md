# Institutional Evidence Workflow Visual Acceptance Criteria

## 1. Current-State Evidence

The archived Playwright evidence is the **pre-revamp current-state baseline**, not an approved redesign target. It records behaviors, content states, responsive weaknesses, and regressions to avoid; it does not require future work to preserve known visual problems.

| Field | Record |
| --- | --- |
| External archive | `C:\Users\LENOVO T14\Development\audit-archives\topic-similarity-pre-revamp-visual-audit-2026-08-04.zip` |
| Archive date | 2026-08-04 |
| Screenshot count | 84 PNG files |
| Result/summary count | 42 JSON files |
| SHA-256 | `A9917E80C9F97A2FC9C2E76CC61BDDE6CBBA77DCD2CB55E03F7D3CCEE5A80884` |
| Current-state commit association | Screenshots were captured against pre-hygiene application commit `83614a248fea69c4f9eafd4baa8522a175024a2e`. PR #132 preserved the visual baseline except for removing the stale Administrator Reports “Soon” marker; this contract is based on `main` at squash commit `6f5a703094e57e51d27f4bba2acacd0e27a7e314`. |
| Repository source evidence | `frontend/test-results/pre-revamp-visual-audit/` (ignored and preserved) |

The archive must not be overwritten, renamed, cleaned, or promoted to target evidence. Verification runs must use a separate ignored output directory.

## 2. Approved Target Evidence

Representative target designs must receive explicit human approval before implementation. Approval of this contract does not approve a particular screen composition.

Each target must include:

- A desktop view at `1440 × 1000`.
- A mobile view at `390 × 844`.
- Tablet or `1280 × 800` evidence when layout behavior is not unambiguous.
- Relevant component and required-state references.
- A version identifier or approval date.
- The approved route and design layer(s).
- Notes identifying intentional differences from current-state evidence.
- Confirmation that data is real, supplied fixture data in a test, or clearly labelled illustrative design content that will not ship.

Approval must name the target artifact or immutable version. Later visual changes require a new approval or an explicitly scoped variance.

## 3. Per-Task Workflow

Every visual implementation task must use this sequence:

1. Record a known-good Git checkpoint and clean worktree.
2. Define one narrowly scoped visual or structural task.
3. Name allowed files.
4. Name forbidden files, including protected APIs, auth, scoring, and unrelated pages.
5. Review the code diff for scope, behavior, literal colours, duplicated primitives, and accidental content changes.
6. Capture a desktop Playwright screenshot at an approved viewport.
7. Capture a mobile Playwright screenshot at an approved viewport.
8. Review console errors, page errors, failed requests, unexpected mutations, and network responses.
9. Check document and component overflow, clipped controls, navigation visibility, and full-page length.
10. Run focused behavior tests plus required automated validation.
11. Obtain human approval or revert the scoped task to its known-good checkpoint.

Do not accumulate several unapproved page redesigns before review. Do not use a later cleanup task to conceal visual differences.

## 4. Required Automated Validation

Run from the existing repository without installing or upgrading packages:

```bash
cd frontend
npm run lint
npm test -- --run --maxWorkers=1 --minWorkers=1
npm run build
```

Required result:

- Lint exits successfully with zero errors and warnings.
- All active frontend test files and tests pass. Any count change is explained exactly.
- Production build exits successfully.
- `frontend/package.json` and `frontend/package-lock.json` remain unchanged unless dependency work was explicitly approved.
- Focused tests for every changed active component or page pass.

Existing non-blocking build warnings must be reported, not silently suppressed. A new warning introduced by the task is a review finding.

## 5. Required Playwright Evidence

For each changed route, capture at least:

- `1440 × 1000`
- `390 × 844`

Use `1280 × 800` and `768 × 1024` when navigation, table, record, modal, or intermediate responsive behavior changes. Store output under a new ignored `frontend/test-results/<task-name>/` directory. Never write into `pre-revamp-visual-audit/`.

Capture all states materially affected by the change, including as applicable:

- Default.
- Loading.
- Empty.
- Populated.
- Error with Retry.
- Partial-success or degraded similarity.
- Long text.
- Disabled or finalized.
- Expanded disclosure.
- Consequential confirmation.

Screenshots must use existing real demo records or deterministic test fixtures. Do not mutate production-like data to manufacture a screenshot.

## 6. Landing-Page-Specific Validation

Every future landing-page target and implementation PR must provide:

- A full-page desktop capture at `1440 × 1000`.
- A full-page mobile capture at `390 × 844`.
- A first-viewport desktop capture.
- A first-viewport mobile capture.
- A navigation-expanded mobile capture when page-anchor navigation collapses into a menu.
- Verification of every approved page anchor, including focus/viewport behavior and accessible naming.
- A factual-claim review.
- An accessibility heading review confirming one visible `h1` and logical section hierarchy.
- Confirmation of no document-level horizontal overflow.
- A Sign In visibility and reachability review at desktop and mobile sizes.
- Confirmation that static workflows, records, diagrams, or architecture visuals are labelled illustrative, staging configuration, or technical architecture as applicable.
- Confirmation that no unsupported claim, fake metric, fake record, fake result, endorsement, or unsourced live status was introduced.

The first-viewport review must confirm that product value, intended users, expected use, and Sign In are understandable before infrastructure. The full-page review must confirm that role journeys, similarity approaches, approval workflow, repository lifecycle, evidence versus decision, governance, technical foundation, and final CTA each have a distinct purpose without repeated filler.

### Content-truthfulness gate

Before approval, classify every product claim as exactly one of:

1. **Directly supported by current implementation** — observable in current routes, APIs, persisted behavior, or verified operational evidence.
2. **Supported but qualified** — accurate only with an explicit scope, availability, staging, or completeness qualification.
3. **Illustrative and explicitly labelled** — used only to explain a workflow or architecture without presenting invented operational evidence.
4. **Unsupported and prohibited** — absent from current implementation/evidence or likely to imply unverified adoption, performance, readiness, capability, or authority.

Unsupported claims must be removed, not softened through visual styling. Example percentages, topic records, scores, activity, health states, endorsements, certification, accreditation, advanced analytics, and production claims require direct evidence or are prohibited.

The completion report must list every changed or newly introduced public claim and its classification. It must also identify removed claims and explain any claim that moved from directly supported to qualified or illustrative.

## 7. Visual and Responsive Gates

A task fails visual acceptance if any reviewed viewport has:

- Document-level horizontal overflow.
- A clipped or obscured route label.
- Navigation that requires undisclosed horizontal scrolling.
- A zero-sized visible action or form control.
- A consequential action hidden by navigation, sticky UI, or viewport clipping.
- More than one visible `h1`.
- A primary task displaced below repeated disclosures or decorative content.
- Unreadable text, excessive tiny uppercase labels, or uncontrolled long-line width.
- Card/surface nesting deeper than two levels without approved justification.
- A mobile desktop-table dump where expandable records were required.
- A modal or drawer with broken focus, inaccessible dismissal, or off-screen actions.

Record full-page dimensions and note material page-length changes. A shorter page is not automatically better if it hides required evidence; a longer page requires a clear functional reason.

## 8. Functional Preservation Gates

Visual acceptance also requires functional parity:

- Routes and role guards are unchanged unless explicitly in scope.
- Cookie authentication, redirects, logout, and protected-route behavior remain intact.
- API endpoints, methods, payloads, response mappings, and persisted behavior remain intact.
- LOW/MEDIUM/HIGH meanings and similarity tiers remain intact.
- Advisory results do not become automatic decisions.
- Submission status values and lecturer rationale rules remain intact.
- Confirmation remains for consequential actions.
- Loading, empty, error, retry, partial-success, and disabled states remain reachable.
- Existing test IDs, labels, accessible names, and landmarks remain intact unless an approved migration updates tests and evidence.
- No fabricated data or unsupported capability appears.

A visually accurate screen that fails a functional gate is not acceptable.

## 9. Console and Network Review

For each browser evidence run, report:

- Console errors and warnings.
- Uncaught page errors.
- Failed requests and HTTP responses at or above 400.
- Blocked or unexpected POST, PUT, PATCH, and DELETE requests.
- Authentication requests expected during page setup.
- Whether data-loading failures are intentionally exercised test states.

Known unauthenticated `/auth/me` responses during public/session initialization must be distinguished from unexpected failures. Rate-limit or setup noise invalidates a run if it prevents the intended page state from being verified.

## 10. Accessibility Review

Check at minimum:

- Keyboard access to navigation, disclosures, forms, tables/records, notifications, and actions.
- Visible focus indication.
- One `h1` and logical heading order.
- Accessible names matching the behavior contract.
- Labels and error association for every form control.
- Expanded/collapsed state for disclosures and menus.
- Dialog name, focus entry, focus containment, cancellation, confirmation, and focus return.
- Text/status meaning without colour.
- Touch target size and spacing at `390 × 844`.
- Reading and focus order after responsive rearrangement.

Automated accessibility checks may supplement but do not replace keyboard and screen-structure review.

## 11. Evidence Comparison and Reporting

Compare implementation screenshots to the specifically approved target, not to the pre-revamp baseline. Use the current-state archive to verify behavior/content preservation and known-problem removal.

The implementation report must identify:

- Target artifact/version.
- Changed routes and files.
- Intentional visual differences.
- Unexpected differences.
- Behavior tests and counts.
- Desktop/mobile screenshot paths.
- Console/network findings.
- Overflow and accessibility findings.
- Remaining limitations.
- Every changed or newly introduced public landing-page claim and its content-truthfulness classification.
- Human approval, requested changes, or revert outcome.

Do not describe a non-identical result as pixel-perfect. Do not hide differences behind viewport, data, timing, or environment changes.

## 12. Approval and Baseline Promotion

Only human-approved implementation evidence may become a new visual baseline. Baseline promotion must:

1. Identify the approving person or decision record.
2. Record the commit and route/state coverage.
3. Preserve the pre-revamp external archive.
4. Store new evidence separately.
5. Record counts and SHA-256 checksum for any external archive.
6. Explain deliberately unsupported or deferred states.

Approval of one representative route does not approve unreviewed changes on another route.

## 13. Revert Conditions

Revert or block a scoped visual task when:

- It changes protected behavior without approval.
- Required tests or build fail.
- It introduces hidden navigation, overflow, inaccessible controls, or duplicate headings.
- It fabricates data or capability.
- It cannot demonstrate parity for a replaced high-risk component.
- Its visual result materially differs from the approved target without an accepted variance.
- Its scope includes unrelated pages or broad formatting.
- Review evidence is missing or the target was never approved.
