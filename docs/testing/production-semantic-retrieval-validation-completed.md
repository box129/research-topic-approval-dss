# C1.2 Production Semantic Retrieval Validation

Benchmark SHA: `b8e295e5a08c13f31d139b726105dc0f03a246243d2a7883938c2e425f5ea3c0`.

Voyage completed 229 query and 229 document embeddings with `voyage-4-large`,
using `input_type=query` and `input_type=document`. Gemini validation is
`VALIDATION_INCOMPLETE`: its first query batch received an explicit free-tier
request-quota 429 and the two authorized retries also received 429 responses.
No Gemini vectors, scores, substitutions, or incomplete metrics were accepted.

Voyage direction sensitivity, semantic metrics, grouped validation, and the
available old-versus-new paired bootstrap interval are in the JSON artifact.
