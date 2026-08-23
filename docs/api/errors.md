# Error Response Reference

This document describes the currently reconciled error response paths for the Topic Similarity API. Paths that have not been reconciled are marked `needs verification`.

> **Current semantic-provider note:** protected direct-similarity routes use
> Voyage and fail closed. A Voyage failure returns the documented `503`
> semantic-unavailable envelope; it does not return SBERT/lexical
> `partial_success`. See the [direct-similarity security contract](direct-similarity-security-contract.md).

## Current Reconciled Error Shape

Reconciled errors use:

```json
{
  "status": "error",
  "message": "Human-readable message",
  "details": {
    "error_code": "ERROR_CODE"
  }
}
```

Some validation responses may also include a `details.field` key.

## Reconciled Error Paths

### Missing Or Empty Topic

Returned by the similarity controller when `topic` is missing, empty, whitespace-only, or not a string.

**HTTP status:** `400`

```json
{
  "status": "error",
  "message": "Topic is required.",
  "details": {
    "field": "topic",
    "error_code": "MISSING_FIELD"
  }
}
```

### Malformed JSON / Invalid Request Format

Returned by shared middleware when the request body cannot be parsed as JSON.

**HTTP status:** `400`

```json
{
  "status": "error",
  "message": "Invalid request format.",
  "details": {
    "error_code": "INVALID_FORMAT"
  }
}
```

### Route Not Found

Returned for unknown routes or unsupported route/method combinations.

**HTTP status:** `404`

```json
{
  "status": "error",
  "message": "Route /api/example not found",
  "details": {
    "error_code": "NOT_FOUND"
  }
}
```

Exact 404 message text depends on the requested path.

### Database Connection Failure

Returned for the documented controller-level database connection failure path.

**HTTP status:** `500`

```json
{
  "status": "error",
  "message": "Database connection failed. Please try again later.",
  "details": {
    "error_code": "DB_CONNECTION_ERROR"
  }
}
```

### Generic Internal Server Error

Returned for generic/unexpected internal server errors.

**HTTP status:** `500`

```json
{
  "status": "error",
  "message": "An unexpected error occurred",
  "details": {
    "error_code": "INTERNAL_ERROR"
  }
}
```

In non-production environments, the message may reflect the thrown error. The public contract should rely on `status` and `details.error_code`, not exact debug text.

### Rate Limit Exceeded

Returned directly by the rate limiter.

**HTTP status:** `429`

```json
{
  "status": "error",
  "message": "Rate limit exceeded. Please try again in 5 minutes.",
  "details": {
    "retry_after": 300,
    "limit": "100 requests per hour"
  }
}
```

Header:

```http
Retry-After: 300
```

The exact configured request window should be checked against environment settings before changing the rate-limit policy.

## Needs Verification

The following paths still need verification before being documented as settled API contract:

| Area | Current status |
|------|----------------|
| `401` unauthorized errors | Protected direct-similarity routes require an active allowed-role session and return the current unauthorized envelope when absent; other legacy endpoint details remain `needs verification`. |
| `403` forbidden errors | Protected direct-similarity routes enforce role/status authorization; other legacy endpoint details remain `needs verification`. |
| Prisma known-request errors | `needs verification`; not all Prisma error variants are reconciled to the staged FYP shape. |
| Prisma validation/query-shape errors | `needs verification`; current middleware behavior may still use older error shape. |
| Generic `503` service-unavailable errors | Protected direct-similarity routes return the Voyage semantic-unavailable `503` contract; unrelated `503` paths remain `needs verification`. |
| Rate-limit enforcement window | `needs verification`; response body says `100 requests per hour`, while runtime config may vary by environment. |

## Frontend Handling Guidance

For reconciled paths, frontend code should read:

```javascript
const message = error.response?.data?.message || 'An unexpected error occurred';
const details = error.response?.data?.details;
const errorCode = details?.error_code;
```

Do not rely on the older `{ success: false, error: { code, message } }` shape for reconciled topic-similarity API paths.
