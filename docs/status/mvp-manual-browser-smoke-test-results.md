# MVP Manual Browser Smoke Test Results

## Verification Context

- Branch: `main`
- Tag: `v0.2.0-rc1`
- Latest verified commit: `8e6e0b5 docs: add MVP release candidate verification results (#31)`
- Browser: Chrome Incognito
- Frontend: `http://localhost:5173`
- Backend: local development backend
- Purpose: record practical minimum browser smoke testing after release-candidate automated verification

## Overall Result

Manual browser smoke test: Passed with minor UI/data-formatting notes.

## Workflows Verified

The following workflows were verified as passed:

- student login
- student My Submissions page
- student submitted topic visible
- pending review status visible
- rejected status visible
- student decision feedback visible
- lecturer login
- lecturer submission detail page
- lecturer similarity pre-check
- high-risk similarity result displayed
- max similarity displayed around `81%` / `81.4%`
- similarity result did not auto-approve or auto-reject the submission
- similarity snapshot history visible
- lecturer decision rationale field visible
- student feedback did not expose lecturer identity
- student feedback did not expose similarity snapshots
- student feedback did not expose internal similarity summaries

## Evidence Observed

- Student My Submissions showed a new pending review topic:

```text
Assessment of Knowledge and Attitude Towards Malaria Prevention Among Undergraduate Students in Osogbo
```

- Student My Submissions also showed a rejected topic with lecturer feedback.
- Lecturer detail page showed Similarity Pre-check.
- Similarity Pre-check returned `HIGH` risk.
- Highest similarity displayed as `81%` / `81.4%`.
- Total matches found displayed as `6`.
- Similarity Check History displayed saved `HIGH` / `SUCCESS` snapshot entries.
- Basic Decision section displayed the decision rationale/comment textarea.
- UI text stated similarity results are advisory and do not change submission status automatically.

## Safety Checks Verified

The following safety checks passed:

- similarity evidence remained advisory
- no auto-approval observed
- no auto-rejection observed
- lecturer rationale remained human-provided
- student feedback exposed safe decision feedback only
- student view did not expose lecturer identity
- student view did not expose similarity snapshots
- student view did not expose internal similarity summaries
- snapshot history appeared as evidence, not final decision

## Minor Notes / Follow-up Polish

These notes are non-blocking:

- Current Session Project showed raw ISO datetime in the Year field, for example `2026-05-01T00:00.000Z`.
- Lecturer similarity result wording used "your topic"; it should later say "this submitted topic."
- Snapshot history showed repeated-looking entries. This is acceptable if caused by repeated manual checks, but future testing should confirm page refresh alone does not create snapshots.
- Some Basic Decision wording is developer-facing and can be polished for lecturer-facing clarity.
- Some new student submissions may show category as "Uncategorised," which is acceptable for MVP if category selection/defaulting is deferred.

## Release Candidate Conclusion

The `v0.2.0-rc1` MVP release candidate passed the practical minimum manual browser smoke test. The observed issues are non-blocking UI/data-formatting notes and do not invalidate the core decision-support workflow.

## Research/Defense Value

The manual browser test provides human-facing evidence beyond automated tests.

It confirms that the artefact works across student and lecturer roles.

It confirms that similarity evidence supports lecturer judgment without replacing the lecturer.

It supports Design Science Research evaluation by documenting observed system behavior in the browser.
