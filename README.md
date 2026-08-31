# Research Topic Approval Decision Support System

A decision-support system for research-topic approval. It helps students and lecturers compare proposed research topics against stored topics using semantic similarity evidence, while keeping the final academic decision with the lecturer.

> The current reviewed implementation uses Voyage AI embeddings and exact cosine similarity. Hosted acceptance for this architecture is still pending. This repository does not claim departmental deployment or production use.

## What the system does

- Students can check a proposed topic before submission.
- Students can submit and revise topics with structured research context.
- Lecturers can review pending submissions, inspect similarity evidence, and approve, reject, or request revision.
- Administrators can manage users, topic records, audit records, and operational diagnostics.

Similarity results are advisory evidence. The system does **not** objectively measure originality and does **not** automatically approve or reject a research topic.

## Current similarity architecture

The reviewed semantic contract is:

- **Provider:** Voyage AI
- **Model:** `voyage-4-large`
- **Embedding dimension:** `1024`
- **Representation:** `structured-context-v1`

A proposed topic is serialized from its title and any supplied research context:

```text
Title: ...
Population: ...
Location: ...
Study focus: ...
```

Blank optional fields are omitted.

The query is embedded with Voyage using the query role. Stored topic representations use the document role.

Eligible stored topics are held in an in-process resident corpus snapshot. Candidates are ranked by **exact cosine similarity**.

PostgreSQL stores application data, topic records, embeddings, and embedding metadata. PostgreSQL does not perform similarity ranking in the current reviewed implementation.

## Semantic compatibility gate

A stored embedding may participate in comparison only when it matches the current semantic contract.

The admission checks include:

1. provider is `voyage`;
2. model is `voyage-4-large`;
3. dimension is `1024`;
4. representation is `structured-context-v1`;
5. stored source hash matches the current serialized topic content;
6. the vector has the expected length and contains finite numeric values.

This prevents incompatible or stale embeddings from silently entering the same comparison.

## Fail-closed similarity

If Voyage is unavailable or returns invalid embedding data, the similarity path reports semantic unavailability and produces **no similarity score**.

The current direct similarity path does not fall back to SBERT, lexical similarity, deterministic embeddings, or fabricated vectors.

An empty eligible corpus is also reported explicitly. An empty comparison set is not presented as evidence that a topic is new or original.

## Human-authoritative decisions

Similarity evidence supports academic review; it does not replace it. Lecturers remain responsible for the final academic judgement.

The reviewed lecturer-decision path also uses an atomic conditional state transition inside a database transaction. If two terminal decisions race, only one pending-to-terminal transition can commit; the losing transaction rolls back instead of leaving contradictory terminal state.

This protects state integrity. It does not decide which lecturer judgement is academically correct.

## Architecture

```text
Browser
  -> HTTPS edge
  -> Nginx
       -> React/Vite SPA
       -> same-origin /api proxy
  -> Node.js / Express backend
       -> PostgreSQL via Prisma
       -> Voyage AI over HTTPS
       -> SMTP when configured
```

The reviewed deployment design currently assumes a single backend instance. Some runtime control state is process-local, so horizontal scaling would require additional shared-control design.

## Technology

- **Backend:** Node.js, Express.js
- **Frontend:** React, Vite
- **Database:** PostgreSQL, Prisma
- **Semantic provider:** Voyage AI
- **Similarity:** exact cosine ranking over an in-process resident corpus
- **Access model:** student, lecturer, and administrator workflows

## Evaluation boundaries

The current similarity thresholds were calibrated on a frozen 120-pair researcher-constructed benchmark using the `structured-context-v1` representation.

That is calibration evidence, not a claim of expert validation or departmental effectiveness.

The repository also contains synthetic and technical scale-evaluation material. Those artefacts support engineering analysis; they do not establish real departmental adoption or real-world semantic accuracy.

## Deployment status

Hosted acceptance for the current Voyage architecture is **prepared but not yet executed**.

This repository does not currently claim:

- completed hosted Render acceptance;
- real departmental deployment;
- production monitoring acceptance;
- real SMTP-provider acceptance;
- real departmental corpus coverage;
- production readiness.

## Historical material

The repository retains earlier SBERT/FastAPI, lexical-scoring, Hugging Face, Vercel, and release-candidate artefacts for history and research provenance.

Those artefacts are not runtime dependencies of the current reviewed Voyage similarity path.

## Documentation

- [Architecture](docs/architecture/)
- [Product and semantic contract](docs/product/)
- [Deployment guidance](docs/deployment/)
- [API documentation](docs/api/)
- [Evaluation materials](backend/evaluation/)