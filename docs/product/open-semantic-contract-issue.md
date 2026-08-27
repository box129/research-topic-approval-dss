# OPEN SEMANTIC CONTRACT ISSUE

**Status: OPEN. NOT FIXED. Requires a separate evaluation and an explicit
decision before hosted staging.**

Raised by the pre-pilot usability audit (`usability-audit.md`, §19) and
deliberately left unresolved by the pre-pilot usability closure, which changed
no scoring or embedding behaviour.

## What was found

The frozen `structured-context-v1` representation serialises a topic as:

```
Title: <title>
Population: <population>      (omitted when absent)
Location: <location>          (omitted when absent)
Study focus: <study focus>    (omitted when absent)
```

Corpus topics — historical imports and approved current-session topics — carry
those three context fields, so they are embedded from the full structured
context.

Student submissions do not. `buildSubmissionTopicShape` in
`backend/src/services/topicCorpusLifecycle.service.js` explicitly passes:

```js
population: null,
location: null,
studyFocus: null
```

**So a student submission is embedded from its title alone.**

This is *not* a defect in the representation. The representation treats those
fields as optional, the code comments the choice deliberately, and the behaviour
is consistent and honest. Nothing is silently wrong today.

## Why it still matters

The similarity checker's own form (`TopicForm`) collects population, location
and study focus. The submission form (`SubmitTopicPage`) collects only title,
category and keywords.

The consequence is a coherence gap rather than a correctness bug:

- The pre-check a student runs is a **richer query** than the one the system
  runs against their actual submission.
- A student can therefore rehearse with structured context, then submit
  something that is compared on title text alone.
- Under-review topics contributed by submissions carry no context for other
  students' checks to compare against either.

## Why it was not fixed

Collecting those fields at submission time would change the **text fed to the
embedding** for submissions. That changes vectors, which changes cosine scores,
which can change where results fall relative to the C1.5 T1/T2 thresholds and
therefore the LOW/MEDIUM/HIGH classification.

That crosses the line from lifecycle (when and how records receive embeddings)
into scoring input (how similarity is calculated). It is out of scope for a
usability change and must not be decided incidentally.

## What a decision needs

Before anything changes, this needs:

1. A decision on whether submissions *should* carry structured context at all,
   or whether title-only submission is the intended contract.
2. If they should: a re-evaluation of score distributions and threshold
   behaviour against the frozen benchmark, since existing corpus embeddings
   would be compared against differently-constructed submission embeddings.
3. A decision on what happens to submissions already embedded title-only —
   whether they are re-embedded, and what that means for stored snapshots.
4. Explicit sign-off that the validated research methodology is being changed
   knowingly, with the evaluation evidence recorded.

## Constraints that still hold

Nothing below may be changed as a side effect of resolving this:

- the Voyage provider, `voyage-4-large`, 1024 dimensions;
- the `structured-context-v1` representation identifier and serialisation order;
- the C1.5 T1/T2 thresholds and the LOW/MEDIUM/HIGH boundaries;
- Jaccard/TF-IDF behaviour and algorithm weights;
- ranking semantics;
- the prohibition on fallback vectors — provider failure stays explicit.

## Confirmation for the pre-pilot usability closure

The pre-pilot usability closure made **no semantic change**. It widened what the
similarity response *displays* alongside an already-computed score, and it
routed revisions through the existing submission embedding path unchanged. The
representation, model, dimensions, thresholds, weights, ranking and classifier
are all untouched, and the synthetic end-to-end run recorded a HIGH
classification at a cosine score of 0.6687 under the existing thresholds.
