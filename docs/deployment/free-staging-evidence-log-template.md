# Free Staging Evidence Log Template

## Status

Use this template only after executing the free managed staging setup. PR #122 adds the template but does not provide completed staging evidence.

Do not commit a filled version if it contains private service URLs, secrets, tokens, database connection strings, screenshots with sensitive data, or real student records.

## Metadata

| Field | Value |
| --- | --- |
| Evidence date | `YYYY-MM-DD` |
| Operator | `name/role only, no private contact details` |
| Repository commit | `<short-hash>` |
| Branch/tag | `<branch-or-tag>` |
| Purpose | `FYP/demo free managed staging proof` |
| Overall result | `PASS / FAIL / PARTIAL / NOT RUN` |

## Provider Summary

| Component | Provider | Result | Notes |
| --- | --- | --- | --- |
| Database | Neon PostgreSQL | `PASS / FAIL / NOT RUN` | Do not include `DATABASE_URL`. |
| SBERT | Hugging Face Spaces | `PASS / FAIL / NOT RUN` | Do not include tokens or full embeddings. |
| Backend | Render Free | `PASS / FAIL / NOT RUN` | Do not include secret env values. |
| Frontend | Vercel | `PASS / FAIL / NOT RUN` | Do not include private tokens. |
| Email | Disabled initially | `DISABLED / SMTP SMOKE PASS / SMTP SMOKE FAIL / NOT RUN` | `EMAIL_PROVIDER=disabled` is expected for first proof. |

## Neon PostgreSQL Evidence

| Check | Result | Safe evidence |
| --- | --- | --- |
| Project/database created | `PASS / FAIL / NOT RUN` | provider dashboard status, no connection string |
| Safe setup evidence note created | `PASS / FAIL / NOT RUN` | link to `neon-staging-setup-evidence.md` if used |
| Region recorded safely | `PASS / FAIL / NOT RUN` | broad region label only if allowed |
| `DATABASE_URL` stored outside Git | `PASS / FAIL / NOT RUN` | yes/no |
| Prisma migrate deploy | `PASS / FAIL / NOT RUN` | command result only |
| Prisma migrate status | `PASS / FAIL / NOT RUN` | up to date/not up to date |

Notes:

```text
No secrets here.
```

## Hugging Face SBERT Evidence

| Check | Result | Safe evidence |
| --- | --- | --- |
| Space created | `PASS / FAIL / NOT RUN` | yes/no |
| SDK set to Docker | `PASS / FAIL / NOT RUN` | yes/no |
| Safe setup evidence note created | `PASS / FAIL / NOT RUN` | link to `huggingface-sbert-space-setup-evidence.md` if used |
| `/health` response | `PASS / FAIL / NOT RUN` | status only |
| Warmup behavior recorded | `PASS / FAIL / NOT RUN` | approximate duration |
| `/embed` safe probe | `PASS / FAIL / NOT RUN` | dimension only, no vector |

Notes:

```text
No full embeddings, tokens, or real student topics.
```

## Render Backend Evidence

| Check | Result | Safe evidence |
| --- | --- | --- |
| Service created | `PASS / FAIL / NOT RUN` | yes/no |
| Build completed | `PASS / FAIL / NOT RUN` | build status only |
| Required env vars configured | `PASS / FAIL / NOT RUN` | variable names only |
| `EMAIL_PROVIDER=disabled` | `PASS / FAIL / NOT RUN` | yes/no |
| `/api/v1/health` | `PASS / FAIL / NOT RUN` | HTTP status and summary |
| `/api/v1/readiness` | `PASS / FAIL / NOT RUN` | ready/degraded/not_ready |
| Logs checked for secret leakage | `PASS / FAIL / NOT RUN` | yes/no |

Notes:

```text
No env values here.
```

## Vercel Frontend Evidence

| Check | Result | Safe evidence |
| --- | --- | --- |
| Project created | `PASS / FAIL / NOT RUN` | yes/no |
| Build completed | `PASS / FAIL / NOT RUN` | build status only |
| Frontend root loads | `PASS / FAIL / NOT RUN` | HTTP status |
| `/api/v1/health` via Vercel reaches Render | `PASS / FAIL / NOT RUN` | HTTP status and backend health summary |
| `/api/v1/readiness` via Vercel reaches Render | `PASS / FAIL / NOT RUN` | readiness summary |

Notes:

```text
No private URLs if policy forbids them.
```

## Free-Tier Limitations Observed

| Limitation | Observed? | Notes |
| --- | --- | --- |
| Render cold start/sleep | `yes/no/not checked` |  |
| Hugging Face Space cold start | `yes/no/not checked` |  |
| Neon free-tier storage/compute limit | `yes/no/not checked` |  |
| Vercel build/request limit | `yes/no/not checked` |  |
| Slow first similarity request | `yes/no/not checked` |  |

## Security And Privacy Check

| Check | Result |
| --- | --- |
| No secrets committed | `PASS / FAIL` |
| No database URLs committed | `PASS / FAIL` |
| No provider tokens committed | `PASS / FAIL` |
| No SMTP credentials committed | `PASS / FAIL` |
| No real student records used | `PASS / FAIL` |
| No fake readiness or fake provider proof used | `PASS / FAIL` |

## Final Decision

Overall result:

```text
PASS / FAIL / PARTIAL / NOT RUN
```

Decision notes:

```text
Explain what passed, what failed, and what remains pending.
```

Follow-up actions:

```text
List only real follow-up work. Do not claim completion for pending items.
```
