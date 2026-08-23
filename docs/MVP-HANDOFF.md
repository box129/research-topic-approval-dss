# MVP Handoff Index

> **Superseded as the current deployment navigation source by Phase 6.** This
> handoff preserves historical MVP/evaluation context, including the former
> SBERT-era similarity workflow. For current deployment architecture and
> operations, use the [Phase 6 production runbook](deployment/deployment-runbook.md),
> [environment matrix](deployment/environment-matrix.md), and
> [direct-similarity contract](api/direct-similarity-security-contract.md).

## Purpose

This document is the central navigation point for the current MVP state of the project. It links the main status, evaluation, planning, testing, and defense documents so the project is easier to review by a developer, supervisor, examiner, or future collaborator.

## Current MVP Summary

The system supports research topic similarity checking for undergraduate research topic approval. The backend similarity foundation is in place, and an Excel import foundation exists for bringing historical and departmental topic records into the project workflow.

The project also includes a pilot evaluation harness for measuring algorithm behavior across controlled topic pairs. Context-aware scoring using `population`, `location`, and `study_focus` currently exists only in the evaluation harness. Production integration is planned, but it has not been implemented yet.

## Key Documents

### MVP Status

- [MVP Phase Status](status/mvp-phase-status.md)

Summarizes completed phases, current scope, deferred work, and the latest evaluation snapshot.

### Evaluation Guide

- [Topic Similarity Evaluation Harness](testing/evaluation.md)

Describes how to run the evaluation harness and interpret the output.

### Production Planning

- [Context-Aware Production Integration Plan](planning/context-aware-production-integration-plan.md)

Describes the safe future plan for moving context-aware scoring into production.

### Defense Notes

- [Evaluation and Defense Notes](defense/evaluation-defense-notes.md)

Contains viva-ready explanations, evaluation interpretation, and caution points.

### Import Testing / Fixture Guide

- [Topic Import Smoke Test](testing/import-smoke.md)

Documents the sample Excel import smoke workflow.

## Latest Evaluation Snapshot

- SBERT available: true
- lexical_max: FP 6, F1 0.471
- SBERT: FP 7, F1 0.667
- weighted_combined: FP 7, F1 0.526
- context_adjusted_combined: FP 0, FN 0, F1 1.000

This snapshot is from a pilot synthetic dataset and should not be described as general 100% accuracy.

## Current Production Boundaries

- production scoring is still title-based
- context-aware scoring is evaluation-only
- production API behavior is unchanged
- Prisma schema is unchanged
- frontend behavior is unchanged

## Recommended Next Work

- Phase 5: production context scoring service behind feature flag
- Phase 6: frontend explanation UI
- Phase 7: larger lecturer-reviewed evaluation dataset
- Phase 8: deployment readiness and final MVP release tag

## Handoff Notes

- use branch and PR workflow
- keep production behavior stable unless intentionally changing it
- avoid claiming general accuracy from pilot data
- prefer documentation and tests before production scoring changes
