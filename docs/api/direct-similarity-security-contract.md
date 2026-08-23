# Direct Similarity Security Contract

This is the current contract for the internet-facing semantic similarity routes. It supersedes older documentation that describes a public, SBERT-backed, lexical-fallback endpoint.

## Routes and authorization

| Route | Authorization |
| --- | --- |
| `POST /api/similarity/check` | Authenticated `student` or `lecturer` session only. |
| `POST /api/v1/check-similarity` | Exact protected alias of the route above. |
| `POST /api/v1/lecturer/submissions/:id/similarity-check` | Authenticated `lecturer` only; it resolves the stored submission server-side and records a snapshot. |

The direct routes read the resident topic corpus and invoke the paid Voyage provider, so they are intentionally not anonymous. A browser client must send the httpOnly session cookie (`withCredentials: true`).

- Missing, invalid, suspended, or credential-version-invalid sessions return `401`.
- Accounts awaiting a forced password change return `403` with `PASSWORD_CHANGE_REQUIRED`.
- Roles other than `student` and `lecturer` return `403 FORBIDDEN` on the direct routes.

In production, a cookie-authenticated mutation must also present an `Origin` or `Referer` resolving to the configured browser origin. An untrusted or absent origin is rejected as `403 CSRF_ORIGIN_REJECTED`.

## Request limits

The request body is JSON. `topic` is required; `population`, `location`, and `studyFocus` are optional semantic context fields. Each supplied string is limited to 1,000 characters. The server also applies a configurable JSON body limit (100 KiB by default).

| Condition | HTTP | Error code |
| --- | --- | --- |
| No usable `topic` | `400` | `MISSING_FIELD` |
| Semantic input field too long | `400` | `SIMILARITY_INPUT_TOO_LARGE` |
| JSON body too large | `413` | `PAYLOAD_TOO_LARGE` |

## Success response

```json
{
  "status": "success",
  "semanticAvailable": true,
  "semanticProvider": "voyage",
  "semanticModel": "voyage-4-large",
  "data": {
    "input_topic": "Machine Learning Applications in Healthcare",
    "corpus_size": 42,
    "overall_risk": "MEDIUM",
    "max_similarity": 0.74,
    "matches": [
      {
        "id": 123,
        "title": "Predictive Models for Clinical Diagnosis",
        "category": "Computer Science",
        "collection": "HISTORICAL",
        "semantic_score": 0.74,
        "similarity_class": "MEDIUM"
      }
    ],
    "recommendation": "Similarity classification is advisory; final academic judgement remains human."
  }
}
```

Scores are raw semantic cosine values, not percentages. The response deliberately does not expose embedding vectors, provider credentials, lexical fallback results, or a final academic decision.

If the searchable corpus is empty, the route returns `200` with an empty `matches` array and `overall_risk`/`max_similarity` set to `null`. That result does not establish originality.

## Semantic provider failures

Voyage is the required semantic provider. A missing key, transport failure, malformed response, or bounded timeout returns:

```json
{
  "status": "semantic_unavailable",
  "message": "Semantic analysis is currently unavailable.",
  "semanticAvailable": false,
  "semanticProvider": "voyage",
  "semanticModel": "voyage-4-large"
}
```

The HTTP status is `503`. There is no SBERT, lexical, fabricated-vector, or score fallback.

## Rate limits

The direct routes have a dedicated expensive-operation limiter. By default it allows 30 semantic checks per authenticated user in 15 minutes; only pre-authentication edge cases fall back to an IP key. This avoids collapsing normal users behind a shared departmental NAT into one semantic quota. The same quota also protects `POST /api/v1/submissions`, because creating a student submission requests a paid Voyage document embedding.

On a limit breach, the server returns `429`, a `Retry-After` header, legacy and standard rate-limit headers, and this stable error shape:

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

The broad global guard, login/recovery/invitation limits, and admin-action limits are separate. Topic-import commits have their own authenticated administrator quota (5 per 15 minutes by default) because imports generate Voyage document embeddings; previews do not. Limits are process-local unless deployment supplies a shared store or equivalent gateway policy; see [the environment matrix](../deployment/environment-matrix.md#rate-limit-deployment-boundary).

## Browser and deployment policy

- CORS permits only the one normalized configured browser origin; production requires explicit `https://` origin configuration and wildcard `*` is rejected in every mode.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- `TRUST_PROXY` defaults to `false`. Only a precise hop count, named subnet, or IP/CIDR allowlist is accepted; `true` and `*` are rejected at startup.
- Voyage calls time out according to `VOYAGE_REQUEST_TIMEOUT_MS` (10 seconds by default).

`GET /api/v1/readiness` is operationally public. It reports only safe provider state: `not_configured`, `configured_not_yet_verified`, `available`, `unavailable`, or `stale`; it never returns a Voyage key or raw provider error.

For exact environment variables and scale-out limitations, use [the environment matrix](../deployment/environment-matrix.md).
