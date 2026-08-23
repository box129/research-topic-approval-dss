# Topic Similarity API Documentation

This document retains the current import contract and historical API context. For the current protected Voyage direct-similarity contract, use [direct-similarity-security-contract.md](direct-similarity-security-contract.md) first.

## Overview

The direct similarity routes compare a submitted research topic against the resident historical, current-session, and eligible under-review corpus through Voyage semantic embeddings. They are authenticated routes and fail closed when the semantic provider is unavailable.

**Base URL:** `http://localhost:3000`  
**Default Content-Type:** `application/json`  
**Import endpoints:** `multipart/form-data`

## Endpoints

### Health Check

**Endpoint:** `GET /health`

**Response:**

```json
{
  "status": "OK",
  "message": "Server is running",
  "environment": "development",
  "apiVersion": "v1"
}
```

### Topic Similarity Check

**Endpoint:** `POST /api/similarity/check`

Architecture alias: `POST /api/v1/check-similarity`

**Authentication:** Required. The caller must hold an active `student` or `lecturer` cookie session. See [the direct-similarity security contract](direct-similarity-security-contract.md) for authorization, request limits, response shapes, CORS/CSRF requirements, and provider failure behavior.

**Request Body:**

```json
{
  "topic": "Knowledge of malaria prevention among children under five",
  "population": "Children under five",
  "location": "Osogbo",
  "studyFocus": "Prevention knowledge"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `topic` | string | Yes | Must be a non-empty string. |
| `population` | string | No | Optional semantic context. |
| `location` | string | No | Optional semantic context. |
| `studyFocus` | string | No | Optional semantic context. |

## Historical Direct-Similarity Response Material

The examples and SBERT/lexical fallback descriptions in this section are retained only as historical context. They are not the current direct-route response contract; use [direct-similarity-security-contract.md](direct-similarity-security-contract.md).

## Historical Normal Success Response

Normal success uses `status: "success"` and a top-level `data` object.

```json
{
  "status": "success",
  "data": {
    "input_topic": "Knowledge of malaria prevention among children under five",
    "word_count": 8,
    "char_count": 60,
    "overall_risk": "HIGH",
    "max_similarity": 88,
    "tier1_historical": [
      {
        "id": 45,
        "title": "Malaria prevention in children",
        "year": "2022/2023",
        "supervisor": "Dr. Adeyemi",
        "category": "Infectious Diseases",
        "jaccard": 65.3,
        "tfidf": 72.1,
        "sbert": 84.2,
        "matched_keywords": ["malaria", "prevention", "children"]
      }
    ],
    "tier2_current": [
      {
        "id": 57,
        "title": "Malaria prevention knowledge among caregivers",
        "approved_date": "2026-01-15T10:30:00.000Z",
        "supervisor": "Dr. Balogun",
        "student_id": "STU-2024-057",
        "jaccard": 48.5,
        "tfidf": 59.2,
        "sbert": 76.8
      }
    ],
    "tier3_under_review": [
      {
        "id": 88,
        "title": "Malaria prevention practices among mothers",
        "reviewing_lecturer": "Dr. Ibrahim",
        "review_started_at": "2026-01-31T14:45:00.000Z",
        "minutes_ago": 30,
        "jaccard": 61.4,
        "tfidf": 68.2,
        "sbert": 88.7
      }
    ],
    "recommendation": "High similarity detected. Coordinate with Dr. Ibrahim before proceeding to avoid duplicate approvals."
  }
}
```

### Normal Data Fields

| Field | Type | Notes |
|-------|------|-------|
| `input_topic` | string | Submitted topic. |
| `word_count` | number | Word count of submitted topic. |
| `char_count` | number | Character count of submitted topic. |
| `overall_risk` | string | `LOW`, `MEDIUM`, or `HIGH`. |
| `max_similarity` | number | Highest SBERT score across returned tiers, exposed as `0-100`. |
| `tier1_historical` | array | Top 5 historical matches. |
| `tier2_current` | array | Current-session matches. |
| `tier3_under_review` | array | Under-review matches from the existing 48-hour query window. |
| `recommendation` | string | Backend-generated recommendation text. |

### Public Score Scale

Returned similarity scores are percentage-style values on a `0-100` scale. Normal success exposes `jaccard`, `tfidf`, and `sbert` separately. It does not expose a public `combined` score.

### Risk And Max Similarity

For normal success:

| Risk | Current implemented rule |
|------|--------------------------|
| `LOW` | Highest SBERT score is below `50`. |
| `MEDIUM` | Highest SBERT score is `50` through `69`. |
| `HIGH` | Highest SBERT score is `70` or higher. |

`max_similarity` is the highest SBERT score across returned Tier 1, Tier 2, and Tier 3 results.

### Tier Fields

**Tier 1 Historical**

| Field | Type |
|-------|------|
| `id` | number |
| `title` | string |
| `year` | string |
| `supervisor` | string |
| `category` | string or null |
| `jaccard` | number |
| `tfidf` | number |
| `sbert` | number |
| `matched_keywords` | array |

**Tier 2 Current**

| Field | Type |
|-------|------|
| `id` | number |
| `title` | string |
| `approved_date` | string or null |
| `supervisor` | string |
| `student_id` | string or null |
| `jaccard` | number |
| `tfidf` | number |
| `sbert` | number |

**Tier 3 Under Review**

| Field | Type |
|-------|------|
| `id` | number |
| `title` | string |
| `reviewing_lecturer` | string or null |
| `review_started_at` | string or null |
| `minutes_ago` | number or null |
| `jaccard` | number |
| `tfidf` | number |
| `sbert` | number |

## No-Topics Success Response

When the database query succeeds but there are no topic records to compare, the endpoint still returns success:

```json
{
  "status": "success",
  "data": {
    "input_topic": "Machine Learning Applications",
    "word_count": 3,
    "char_count": 29,
    "overall_risk": "LOW",
    "max_similarity": 0,
    "tier1_historical": [],
    "tier2_current": [],
    "tier3_under_review": [],
    "recommendation": "Topic appears unique. Proceed with approval."
  }
}
```

## Partial Success / SBERT Degraded Response

When SBERT is unavailable, the endpoint returns `partial_success`, keeps the top-level warning message, and exposes lexical scores only. Returned match objects set `sbert` to `null`.

```json
{
  "status": "partial_success",
  "message": "SBERT semantic analysis unavailable. Showing lexical similarity only (Jaccard, TF-IDF).",
  "data": {
    "input_topic": "Knowledge of malaria prevention among children under five",
    "word_count": 8,
    "char_count": 60,
    "overall_risk": "MEDIUM",
    "max_similarity": 72.1,
    "tier1_historical": [
      {
        "id": 45,
        "title": "Malaria prevention in children",
        "year": "2022/2023",
        "supervisor": "Dr. Adeyemi",
        "category": "Infectious Diseases",
        "jaccard": 65.3,
        "tfidf": 72.1,
        "sbert": null,
        "matched_keywords": ["malaria", "prevention"]
      }
    ],
    "tier2_current": [],
    "tier3_under_review": []
  }
}
```

For partial success, `max_similarity` and `overall_risk` are based on the highest lexical score, using `max(jaccard, tfidf)` across returned tiers.

## Topic Import Preview

**Endpoint:** `POST /api/import/topics/preview`

Architecture alias: `POST /api/v1/import/topics/preview`

**Content-Type:** `multipart/form-data`

Preview parses and normalizes an uploaded `.xlsx` file without writing records to the database.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | file | Yes | Only `.xlsx` files are supported. Maximum upload size is 5MB. |
| `sheetName` | string | No | Optional worksheet name. Defaults to the first worksheet. |

**Success Response:**

```json
{
  "status": "success",
  "data": {
    "mode": "preview",
    "metadata": {
      "sheet_name": "Topics",
      "total_parsed_rows": 10,
      "warnings": []
    },
    "records": [],
    "import_report": {
      "total_rows": 10,
      "accepted_rows": 8,
      "skipped_rows": 2,
      "missing_title_rows": 1,
      "incomplete_context_rows": 4,
      "duplicate_title_rows": 1
    }
  }
}
```

## Topic Import Commit

**Endpoint:** `POST /api/import/topics/commit`

Architecture alias: `POST /api/v1/import/topics/commit`

**Content-Type:** `multipart/form-data`

Commit parses and normalizes accepted `.xlsx` records by lifecycle bucket, then generates a validated Voyage document embedding for each new record before persistence. If embedding generation fails, the commit is aborted before any records are persisted. It does not run a similarity check.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | file | Yes | Only `.xlsx` files are supported. Maximum upload size is 5MB. |
| `sheetName` | string | No | Optional worksheet name. Defaults to the first worksheet. |
| `sourceType` | string | No | Defaults to `xlsx`. |
| `sourceFilename` | string | No | Defaults to the uploaded original filename. |
| `importBatchId` | string | No | Defaults to a generated value like `import-1777777777777`. |

**Success Response:**

```json
{
  "status": "success",
  "data": {
    "mode": "commit",
    "metadata": {
      "sheet_name": "Topics",
      "total_parsed_rows": 10,
      "warnings": []
    },
    "import_report": {
      "total_rows": 10,
      "accepted_rows": 8,
      "skipped_rows": 2,
      "missing_title_rows": 1,
      "incomplete_context_rows": 4,
      "duplicate_title_rows": 1
    },
    "persistence_report": {
      "attempted_records": 8,
      "inserted_records": 8,
      "failed_records": 0,
      "skipped_records": 0,
      "inserted_by_bucket": {
        "historical": 6,
        "current_session": 1,
        "under_review": 1
      },
      "warnings": [],
      "errors": []
    }
  }
}
```

## Topic Import Errors

Import errors use the same `status`, `message`, and `details` style:

| Case | HTTP | `details.error_code` |
|------|------|----------------------|
| Missing file | `400` | `MISSING_FILE` |
| Unsupported file extension | `400` | `UNSUPPORTED_FILE_TYPE` |
| Worksheet not found | `400` | `WORKSHEET_NOT_FOUND` |
| File larger than 5MB | `413` | `FILE_TOO_LARGE` |

## Error Responses

Reconciled error responses use this shape:

```json
{
  "status": "error",
  "message": "Human-readable message",
  "details": {
    "error_code": "ERROR_CODE"
  }
}
```

See [errors.md](errors.md) for the current reconciled error paths and paths that still need verification.

## Current Rate Limiting

Current documented response body for rate limiting:

```json
{
  "status": "error",
  "message": "Too many requests. Please try again later.",
  "details": {
    "error_code": "RATE_LIMIT_EXCEEDED",
    "limiter": "similarity",
    "retry_after": 123,
    "limit": "30 requests per 15 minutes",
    "window_seconds": 900
  }
}
```

The response includes:

```http
Retry-After: <seconds-until-reset>
```

The values are environment-configurable. The direct semantic limit is user-keyed after authentication, while the broad guard is user-keyed for valid sessions and IP-keyed for public traffic. See [the direct-similarity security contract](direct-similarity-security-contract.md) and [the environment matrix](../deployment/environment-matrix.md).

## Notes

- Category is currently returned as metadata and is not documented as a retrieval filter.
- Same-lecturer Tier 3 suppression is blocked until trusted lecturer identity is available in the request/auth context.
- Some internal combined-score calculations still exist in code, but they are not part of the current public normal-success API contract.
