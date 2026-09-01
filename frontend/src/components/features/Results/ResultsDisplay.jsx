import { useState } from 'react';
import PropTypes from 'prop-types';
import SimilarityClassificationChip, {
  classificationLabel,
  normalizeClassification
} from './SimilarityClassificationChip';

// ============ Utility Functions ============

// Raw directional semantic cosine, displayed to three decimal places. Never a
// percentage, never multiplied, never clamped, never labelled as confidence or
// probability.
const formatScore = (score) => {
  if (score === null || score === undefined) return 'N/A';
  return Number(score).toFixed(3);
};

const COLLECTION_TIER_LABEL = {
  HISTORICAL: 'previous-session record',
  CURRENT_SESSION: 'current-session record',
  UNDER_REVIEW: 'under-review record'
};

const COUNT_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five'];

// One ranked list, not a card grid (Board A R4). The API returns matches
// ranked by semantic similarity; the API mapper splits them by collection, so
// the merge re-sorts on the backend-provided score purely to restore that
// presentation order. Classification is never derived from the score (N-3).
function rankedRecords(results) {
  return [
    ...(results.tier1_matches || []),
    ...(results.tier2_matches || []),
    ...(results.tier3_matches || [])
  ].sort((a, b) => {
    const aScore = Number.isFinite(a?.semantic_score) ? a.semantic_score : -Infinity;
    const bScore = Number.isFinite(b?.semantic_score) ? b.semantic_score : -Infinity;
    return bScore - aScore;
  });
}

function compositionSummary(records) {
  const counts = { HISTORICAL: 0, CURRENT_SESSION: 0, UNDER_REVIEW: 0 };
  records.forEach((record) => {
    if (counts[record.collection] !== undefined) counts[record.collection] += 1;
  });

  const parts = [];
  if (counts.HISTORICAL > 0) {
    parts.push(counts.HISTORICAL === 1 ? '1 from a previous session' : `${counts.HISTORICAL} from previous sessions`);
  }
  if (counts.CURRENT_SESSION > 0) parts.push(`${counts.CURRENT_SESSION} from the current session`);
  if (counts.UNDER_REVIEW > 0) parts.push(`${counts.UNDER_REVIEW} under review`);
  return parts.join(' · ');
}

// Lead lines report what the check found; they never prescribe an academic
// action (Board A R9). The subject noun follows the surface: a checker checks
// a proposal, the review detail embeds evidence about a submission.
function leadContent(classification, records, subjectNoun, isStudent) {
  if (classification === 'HIGH') {
    const closeCount = records.filter((record) => normalizeClassification(record.similarity_class) === 'HIGH').length;
    const countWord = closeCount >= 1 && closeCount < COUNT_WORDS.length ? COUNT_WORDS[closeCount] : null;
    const readClause = isStudent ? 'before deciding whether to submit' : 'before deciding';

    if (closeCount === 1) {
      return { lead: `One stored record is closely related to this ${subjectNoun}. Read it ${readClause}.` };
    }
    if (closeCount > 1) {
      return { lead: `${countWord || closeCount} stored records are closely related to this ${subjectNoun}. Read them ${readClause}.` };
    }
    return { lead: `Stored records closely related to this ${subjectNoun} were found. Read them ${readClause}.` };
  }

  if (classification === 'MEDIUM') {
    return isStudent
      ? { lead: `Some stored records overlap with this ${subjectNoun}. Compare their population, location and study focus with your own.` }
      : { lead: `Some stored records overlap with this ${subjectNoun}. Their population, location and study focus are shown below for comparison.` };
  }

  if (classification === 'LOW') {
    return {
      lead: `No stored record is closely related to this ${subjectNoun}.`,
      denial: 'This does not establish that the topic is new or original.',
      scopeNote: isStudent
        ? 'The comparison covers stored departmental records only, and your lecturer makes the academic decision.'
        : 'The comparison covers stored departmental records only.'
    };
  }

  // NOT_CLASSIFIED with records present should not occur, but degrade
  // truthfully: name the absence of a classification without inventing one.
  return {
    lead: 'No similarity classification was returned for this check.',
    denial: 'This does not establish that the topic is new or original.'
  };
}

function ProvenanceItem({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-text-muted">{label}</dt>
      <dd className={`mt-0.5 text-[14px] text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

ProvenanceItem.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  mono: PropTypes.bool
};

// Check provenance: counts and the top-record cosine, with the one sentence
// that keeps the number from being read as a probability (Board A R2). The
// disclaimer is subordinate, never illegible: 13.5px at AA contrast.
function ProvenanceStrip({ corpusSize, returnedCount, maxSimilarity }) {
  return (
    <section aria-label="Check provenance" className="rounded-[10px] bg-surface-muted px-4 py-3" data-testid="check-provenance">
      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        <ProvenanceItem label="Records compared" value={corpusSize ?? '—'} />
        <ProvenanceItem label="Records returned" value={returnedCount} />
        <ProvenanceItem label="Cosine, top record" value={<span data-testid="provenance-cosine">{formatScore(maxSimilarity)}</span>} mono />
      </dl>
      <p className="mt-2 text-[13.5px] leading-5 text-text-secondary">
        Technical similarity score, not a percentage of duplication, originality or probability.
      </p>
    </section>
  );
}

ProvenanceStrip.propTypes = {
  corpusSize: PropTypes.number,
  returnedCount: PropTypes.number.isRequired,
  maxSimilarity: PropTypes.number
};

// A stored record row. One 600-weight run (the title; 500 on an overall-LOW
// result, where nothing found is a finding of substance), labels
// colour-differentiated and never bold, no inner borders, no icons — the rank
// ordinal replaces the old warning triangle (Board A R3/R4).
function StoredRecord({ record, rank, index, overallClassification, subjectLabelId }) {
  const contextFields = [
    ['Population', record.population, 'record-population'],
    ['Location', record.location, 'record-location'],
    ['Study focus', record.study_focus, 'record-study-focus']
  ].filter(([, value]) => Boolean(value));

  const isUnderReview = record.collection === 'UNDER_REVIEW';
  const metaParts = [];
  if (record.supervisor_name) {
    metaParts.push(isUnderReview ? `Reviewing lecturer: ${record.supervisor_name}` : record.supervisor_name);
  }
  if (record.session_year) {
    metaParts.push(isUnderReview ? `review started ${record.session_year}` : `${record.session_year} session`);
  }
  if (COLLECTION_TIER_LABEL[record.collection]) {
    metaParts.push(COLLECTION_TIER_LABEL[record.collection]);
  }

  return (
    <li className="px-4 py-4 sm:px-5" data-testid={`record-${index}`} aria-labelledby={subjectLabelId}>
      <div className="flex gap-3">
        <span aria-hidden="true" className="mt-0.5 shrink-0 font-mono text-[13.5px] font-medium leading-6 text-text-secondary">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <h4
              id={subjectLabelId}
              className={`break-words text-[15.5px] leading-6 text-text-primary ${overallClassification === 'LOW' ? 'font-medium' : 'font-semibold'}`}
              data-testid={`record-title-${index}`}
            >
              <span className="sr-only">{`Rank ${rank}: `}</span>
              {record.topic_title}
            </h4>
            <span className="shrink-0">
              <SimilarityClassificationChip value={record.similarity_class} data-testid={`record-class-${index}`} />
            </span>
          </div>

          {contextFields.length > 0 && (
            <dl className="mt-2 space-y-1" data-testid={`record-context-${index}`}>
              {contextFields.map(([label, value, testId]) => (
                <div key={label} className="min-w-0 text-[14px] leading-6">
                  <dt className="inline font-medium text-text-muted">{label}</dt>{' '}
                  <dd className="inline break-words text-text-primary" data-testid={`${testId}-${index}`}>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {(metaParts.length > 0 || Number.isFinite(record.semantic_score)) && (
          <p className="mt-2 text-[13.5px] leading-5 text-text-secondary" data-testid={`record-meta-${index}`}>
            {metaParts.map((part, partIndex) => (
              <span key={part}>
                {partIndex > 0 && ' · '}
                {part}
              </span>
            ))}
            {Number.isFinite(record.semantic_score) && (
              <span data-testid={`record-cosine-${index}`}>
                {metaParts.length > 0 && ' · '}
                <span className="font-mono text-[13px]">cosine {formatScore(record.semantic_score)}</span>
              </span>
            )}
          </p>
          )}
        </div>
      </div>
    </li>
  );
}

StoredRecord.propTypes = {
  record: PropTypes.object.isRequired,
  rank: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  overallClassification: PropTypes.string.isRequired,
  subjectLabelId: PropTypes.string.isRequired
};

/**
 * ResultsDisplay — the frozen Board A similarity evidence system.
 *
 * Communicates what the system found, never what anyone should decide.
 * Classification is the primary human-readable result; the raw cosine is
 * subordinate technical provenance shown to three decimal places, never as a
 * percentage. Per-record classification comes only from the backend's
 * `similarity_class`; the component never derives a classification from a
 * numeric score. Everything rests in neutral ink: similarity evidence never
 * wears approval green, revision amber or rejection red, and its affordances
 * rest in underlined ink so decision colour stays with human controls.
 *
 * @param {Object} props.results - Normalized results object from the API
 *   mapper: risk_level (internal compatibility field name for the backend's
 *   overall classification token), max_similarity (raw cosine), corpus_size,
 *   tier1/2/3_matches with per-match semantic_score and similarity_class.
 * @param {string} props.appearance - 'student-checker' | 'lecturer-checker' |
 *   'default' (embedded in the lecturer review detail).
 */
const ResultsDisplay = ({ results, appearance = 'default' }) => {
  const [showAllRecords, setShowAllRecords] = useState(false);

  const isStudent = appearance === 'student-checker';
  const subjectNoun = appearance === 'default' ? 'submission' : 'proposal';

  const records = rankedRecords(results);
  const isEmptyCorpus = results.corpus_size === 0;
  const classification = isEmptyCorpus ? 'NOT_CLASSIFIED' : normalizeClassification(results.risk_level);

  // Disclosure as emphasis (R5): higher similarity opens every record;
  // moderate and lower open the top record only. The count stays visible so
  // nothing is hidden — only deferred.
  const defaultVisible = classification === 'HIGH' ? records.length : Math.min(records.length, 1);
  const visibleRecords = showAllRecords ? records : records.slice(0, defaultVisible);
  const hiddenCount = records.length - defaultVisible;

  const content = isEmptyCorpus
    ? {
      lead: 'No comparison could be made. There are no eligible stored topics to compare against.',
      denial: 'This does not establish that the topic is new or original.',
      scopeNote: 'No similarity classification has been assigned, because nothing was compared.'
    }
    : leadContent(classification, records, subjectNoun, isStudent);

  return (
    <div
      className="w-full space-y-4 p-4 sm:p-5"
      data-testid="results-display"
      data-classification={classification}
    >
      {/* Classification block: the primary human-readable result. */}
      <section aria-label="Similarity classification" data-testid={isEmptyCorpus ? 'empty-corpus' : 'classification-block'}>
        <p className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-text-muted">
          Similarity classification
        </p>
        <div className="mt-2">
          <SimilarityClassificationChip
            value={isEmptyCorpus ? null : results.risk_level}
            showToken
            data-testid="similarity-classification"
          />
        </div>
        <p className="mt-3 max-w-[62ch] text-[15px] font-medium leading-6 text-text-primary" data-testid="classification-lead">
          {content.lead}
        </p>
        {content.denial && (
          <p className="mt-1.5 max-w-[62ch] text-[15px] font-medium leading-6 text-text-primary" data-testid="originality-denial">
            {content.denial}
          </p>
        )}
        {content.scopeNote && (
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-5 text-text-secondary">
            {content.scopeNote}
          </p>
        )}
        {isStudent && !isEmptyCorpus && classification !== 'LOW' && (
          <p className="mt-2 max-w-[62ch] text-[13.5px] leading-5 text-text-secondary" data-testid="boundary-line">
            Similarity evidence supports your judgement. It does not approve, reject or certify originality — your lecturer makes the academic decision.
          </p>
        )}
      </section>

      <ProvenanceStrip
        corpusSize={results.corpus_size ?? null}
        returnedCount={records.length}
        maxSimilarity={results.max_similarity}
      />

      {/* Stored records: one ranked bordered list. Ends the surface — an empty
          corpus adds no records section and no filler (R6). */}
      {!isEmptyCorpus && records.length > 0 && (
        <section aria-label="Closest stored records" data-testid="records-section">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-[15px] font-semibold text-text-primary">Closest stored records</h3>
            <p className="text-[13.5px] text-text-secondary">{compositionSummary(records)}</p>
          </div>
          <p className="mt-0.5 text-[13.5px] text-text-secondary">
            {classification === 'LOW'
              ? 'The nearest records found — none is closely related.'
              : `Ranked by semantic similarity to your ${subjectNoun}.`}
          </p>

          <ol className="mt-3 divide-y divide-border-subtle rounded-[10px] border border-border-subtle bg-white">
            {visibleRecords.map((record, index) => (
              <StoredRecord
                key={`${record.collection}-${record.id}-${index}`}
                record={record}
                rank={String(index + 1).padStart(2, '0')}
                index={index}
                overallClassification={classification}
                subjectLabelId={`similarity-record-${appearance}-${index}`}
              />
            ))}
          </ol>

          {hiddenCount > 0 && (
            <button
              type="button"
              className="mt-3 text-[14px] font-medium text-text-primary underline underline-offset-2 hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2"
              aria-expanded={showAllRecords}
              onClick={() => setShowAllRecords((current) => !current)}
              data-testid="show-more-records"
            >
              {showAllRecords ? 'Show fewer records' : `Show ${hiddenCount} more record${hiddenCount === 1 ? '' : 's'}`}
            </button>
          )}
        </section>
      )}

      {/* Zero returned records on a comparison that ran: a different condition
          from an empty corpus, stated neutrally — never as a pass. */}
      {!isEmptyCorpus && records.length === 0 && (
        <section
          className="rounded-[10px] border border-border-subtle bg-white px-5 py-5"
          data-testid="no-matches"
        >
          <p className="text-[15px] font-medium text-text-primary">No stored records were returned by this check.</p>
          <p className="mt-1.5 text-[13.5px] leading-5 text-text-secondary">
            This does not establish that the topic is new or original. Review the {subjectNoun} and its context before deciding how to proceed.
          </p>
        </section>
      )}
    </div>
  );
};

// ============ PropTypes Definition ============
const MATCH_SHAPE = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  topic_title: PropTypes.string.isRequired,
  supervisor_name: PropTypes.string,
  session_year: PropTypes.string,
  // Research context from the stored record. Every one of these is optional:
  // historical imports are uneven and submission-sourced under-review rows carry
  // none of them, so the display skips each field individually when absent.
  category: PropTypes.string,
  population: PropTypes.string,
  location: PropTypes.string,
  study_focus: PropTypes.string,
  collection: PropTypes.oneOf(['HISTORICAL', 'CURRENT_SESSION', 'UNDER_REVIEW']).isRequired,
  semantic_score: PropTypes.number.isRequired,
  similarity_class: PropTypes.oneOf(['LOW', 'MEDIUM', 'HIGH'])
});

ResultsDisplay.propTypes = {
  results: PropTypes.shape({
    // Internal compatibility field name for the backend's overall
    // classification token; null when the backend asserted no classification
    // (empty comparison corpus). Never coerced to LOW, and never rendered
    // with "risk" vocabulary.
    risk_level: PropTypes.oneOf(['LOW', 'MEDIUM', 'HIGH']),
    max_similarity: PropTypes.number,
    corpus_size: PropTypes.number,
    recommendation: PropTypes.string,
    tier1_matches: PropTypes.arrayOf(MATCH_SHAPE),
    tier2_matches: PropTypes.arrayOf(MATCH_SHAPE),
    tier3_matches: PropTypes.arrayOf(MATCH_SHAPE),
    semantic_available: PropTypes.bool
  }).isRequired,
  appearance: PropTypes.oneOf(['default', 'student-checker', 'lecturer-checker'])
};

export default ResultsDisplay;
