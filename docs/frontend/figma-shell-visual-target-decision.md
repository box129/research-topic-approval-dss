# Figma-Style App Shell Visual Target Decision

## Decision context

- The screenshot-based visual fidelity audit found that many authenticated pages are far from the original Figma screenshots.
- The main visual gap is the current sidebar/dashboard shell compared with the Figma top-navigation and richer page composition.
- The current implementation remains behavior-safe and functionally verified.
- This decision records the visual target for future polish work.
- This document is docs-only and does not change runtime behavior.

## Decision

- Adopt the Figma-style app shell and page composition as the visual target for authenticated pages.
- Do not preserve the current sidebar shell as the final visual direction.
- Future visual fidelity work should move pages closer to Figma's navigation, spacing, content framing, dashboard composition, cards, tables, and forms.
- Current working behavior remains the functional source of truth.

## Visual source of truth

- Local Figma screenshots in `img/`.
- Screenshot-based visual fidelity audit results.
- Figma page composition, spacing, hierarchy, navigation, cards, tables, forms, and dashboard structure.

## Functional source of truth

- Current routes.
- Current auth/protected route behavior.
- Current API behavior.
- Current backend capabilities.
- Current similarity, snapshot, decision, and student feedback behavior.
- Current honest unavailable and not-connected states where backend support does not exist.

## What this means for future PRs

- Future visual polish should move authenticated pages toward the Figma-style top navigation and page framing.
- Shared layout work should happen before deep page-specific polish so pages align to the same shell direction.
- Page-level polish should preserve the current route structure and behavior while improving visual fidelity.
- Visual changes should be validated with browser screenshots against local Figma references.
- Behavior-safe unavailable states should remain explicit where the backend does not yet support Figma-shown data.

## What must not change

- Current route paths must not change.
- Auth and protected-route behavior must not change.
- Login payloads and role redirect behavior must not change.
- API contracts must not change.
- Backend capabilities must not be implied if they do not exist.
- Similarity, snapshot, lecturer decision, and student feedback behavior must not change.

## How unsupported Figma data/features should be handled

Where Figma shows unsupported data or features, keep the Figma-like visual structure but render honest states such as:

- `Not connected yet`
- `Not available yet`
- `Coming later`
- `No data available`
- Disabled controls until backend support exists

Do not add:

- Fake metrics
- Fake admin health
- Fake reports
- Fake audit events
- Fake activity
- Fake approved topics
- Fake analytics
- Unsupported bulk actions
- Unsupported export/import
- Unsupported supervisor assignment
- Unsupported decision shortcuts

## Recommended implementation sequence

1. PR #67: implement Figma-style shared authenticated app shell.
2. PR #68: align student dashboard and submit topic to the Figma shell.
3. PR #69: align student submissions, checker, and research explorer shell.
4. PR #70: align lecturer dashboard and pending reviews.
5. PR #71: align lecturer checker and submission detail where needed.
6. PR #72: align admin dashboard shell while preserving honest non-live states.
7. PR #73: capture post-alignment screenshots and document visual evidence.

## Safety boundaries

- No backend behavior changes.
- No Prisma/migration changes.
- No API contract changes.
- No auth/protected route changes.
- No route path changes.
- No similarity scoring/threshold/ranking changes.
- No snapshot behavior changes.
- No lecturer decision payload changes.
- No student feedback behavior changes.
- No fake data.
- No `img/` or screenshot artifact commits.

## Result

The Figma-style app shell and page composition is the approved visual target for authenticated pages. Future visual fidelity PRs should move the UI toward the original Figma navigation, spacing, framing, and dashboard structure while preserving current working behavior and honest unavailable states.
