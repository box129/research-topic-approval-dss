# Topic Import Workflow

## Purpose

Import support exists because departmental research topic records are mostly spreadsheet-based and may be incomplete. Lecturer interview findings show that topic titles are usually available, but keywords, population, location, and study focus may be missing or inconsistent.

The current import foundation is designed to tolerate incomplete records safely while supporting backend preview and commit endpoints. PR #103 connects the admin Topic Repository frontend to the audited `.xlsx` preview and commit workflow, while embedding generation, duplicate-existing checks, richer row-level reports, and similarity integration remain deferred.

## Current Flow

```text
.xlsx file -> worksheet rows -> plain row objects -> normalizer -> records + report -> persistence service
```

The import flow currently has three backend service layers:

- `backend/src/services/topicImportFile.service.js`
  - Reads `.xlsx` files with `exceljs`.
  - Uses the first worksheet by default.
  - Converts worksheet rows into plain JavaScript objects using the header row.
  - Passes parsed rows into `normalizeTopicImportRows`.

- `backend/src/services/topicImport.service.js`
  - Normalizes plain row objects into topic import records.
  - Handles flexible title aliases and optional context fields.
  - Preserves the original row as `raw_record`.
  - Returns normalized records plus an import report.

- `backend/src/services/topicImportPersistence.service.js`
  - Persists normalized records to Prisma models.
  - Routes records by `lifecycle_bucket`.
  - Stores context and import metadata fields prepared in the Prisma schema.
  - Returns a persistence report with inserted, skipped, failed, and per-bucket counts.

The backend also exposes preview and commit API endpoints:

- `POST /api/import/topics/preview`
  - Parses and normalizes an uploaded `.xlsx` file.
  - Returns records and the import report.
  - Does not persist records.
  - Requires authenticated admin access.

- `POST /api/import/topics/commit`
  - Parses and normalizes an uploaded `.xlsx` file.
  - Persists accepted records by lifecycle bucket.
  - Returns the import report and persistence report.
  - Requires authenticated admin access.

Admin-prefixed v1 aliases are also available for operational use:

- `POST /api/v1/admin/import/topics/preview`
- `POST /api/v1/admin/import/topics/commit`

A repeatable smoke-test workflow is documented in [`../testing/import-smoke.md`](../testing/import-smoke.md).

## Frontend Import UI Status

PR #103 adds a real admin import panel to `/admin/topic-repository`.

The panel:

- Allows admins to select a `.xlsx` file.
- Calls `POST /api/v1/admin/import/topics/preview` for preview.
- Renders the backend `import_report` and accepted-record count returned by the preview endpoint.
- Enables commit only after a successful preview.
- Calls `POST /api/v1/admin/import/topics/commit` with the selected file.
- Renders the backend `import_report` and `persistence_report` returned by the commit endpoint.
- Shows loading, success, and backend error states without substitute results.
- States that import actions are admin-only and audited.

The panel does not fabricate duplicate-existing findings, row-level details, embeddings, similarity results, exports, downloads, CSV imports, migrations, or topic edit/delete actions.

## Evaluation And Data-Quality Evidence Status

PR #105 adds read-only evaluation/data-quality evidence for topic records without changing import behavior.

New evidence commands:

```powershell
cd backend
npm run evaluate:topics
npm run audit:data-quality
```

The data-quality audit inspects existing lifecycle topic records and reports safe aggregate counts for missing fields, embedding coverage, import warnings, source/import-batch grouping, and hashed normalized duplicate-title candidates. It does not mutate imported records, generate embeddings, recalculate similarity, or fabricate duplicate-existing findings.

Current generated data-quality evidence is stored in:

```text
backend/evaluation/results/topic-data-quality-audit.json
docs/testing/topic-data-quality-report.md
```

## Normalized Record Fields

Each accepted record can include:

- `title`
- `keywords`
- `population`
- `location`
- `study_focus`
- `lifecycle_bucket`
- `raw_record`
- `warnings`

`title` is required. Rows without a usable title are skipped and counted in the report.

`keywords` may be provided as a comma-separated string or an array. Missing keywords are accepted.

`population`, `location`, and `study_focus` are optional for now. Missing values do not block import, but they add warnings because lecturers consider these fields important when judging topic similarity.

## Lifecycle Buckets

Supported lifecycle buckets are:

- `historical`
- `current_session`
- `under_review`

If no lifecycle bucket is provided, the normalizer defaults to `historical`.

Rows may contain `status`, but it is only mapped to `lifecycle_bucket` when it clearly matches one of the supported lifecycle buckets. Otherwise, the status value remains in `raw_record` and a warning is added.

## Import Report

The import report includes:

- `total_rows`
- `accepted_rows`
- `skipped_rows`
- `missing_title_rows`
- `incomplete_context_rows`
- `duplicate_title_rows`

Duplicate titles are detected within the same import batch using a case-insensitive trimmed title. The first matching row is accepted, and later duplicate-title rows are skipped.

Missing-title rows increment both `skipped_rows` and `missing_title_rows`.

Duplicate-title rows increment both `skipped_rows` and `duplicate_title_rows`.

`incomplete_context_rows` counts accepted rows missing at least one of `population`, `location`, or `study_focus`.

## Current Limitations

- The frontend import UI is wired only to the existing admin `.xlsx` preview and commit endpoints.
- PR #105 data-quality audit reports aggregate stored-topic evidence only; it does not extend preview/commit report shape.
- No similarity scoring integration yet.
- No embedding generation for imported records yet.
- Import endpoints are admin-protected, but richer duplicate-existing checks and row-level operator reports remain deferred.
- CSV import remains separate from this `.xlsx` import workflow.
- Export/download, migration, and topic edit/delete workflows are not part of the import UI.

## Follow-Up Work

- Add richer duplicate-existing checks and operator-facing row-level report details.
- Add embedding generation for imported records.
- Integrate imported context fields into similarity scoring.
- Add import result drill-down only after the backend returns stable row-level report data.
- Test the workflow with real sample departmental records.
- Add evaluation cases for incomplete and spreadsheet-imported records.
