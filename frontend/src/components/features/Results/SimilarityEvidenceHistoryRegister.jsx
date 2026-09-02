import { useState } from 'react';
import PropTypes from 'prop-types';
import SimilarityClassificationChip from './SimilarityClassificationChip';

// Neutral historical-classification token. An unknown-contract row keeps its
// stored raw token (HIGH/MEDIUM/LOW) exactly as recorded — never translated
// into the current plain-language vocabulary, never recomputed — but rests in
// neutral ink: on a decided record, red must mean the human decision, never a
// historical similarity reading.
export function RecordedClassificationToken({ token, ...rest }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" {...rest}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Recorded</span>
      <span className="inline-flex items-center rounded-[5px] border border-border-strong bg-white px-1.5 py-0.5 font-mono text-[12.5px] leading-5 text-text-primary">
        {token || 'NOT CLASSIFIED'}
      </span>
    </span>
  );
}

RecordedClassificationToken.propTypes = {
  token: PropTypes.string
};

// The scoring contract stamped on snapshots written by the current similarity
// pipeline. Only rows carrying this exact marker may be presented as raw
// cosine; rows without it were recorded before contract stamping existed, so
// their scale is unknown and the stored number is shown without a scale claim.
// Marker presence — never the numeric range of the value — decides which
// presentation a row gets.
export const VOYAGE_RAW_COSINE_CONTRACT = 'voyage-raw-cosine-v1';

// The snapshot endpoint returns at most this many rows and is not paginated,
// so a full response of exactly this size cannot be described as complete.
export const HISTORY_LIMIT = 10;

export function formatCosineScore(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(3) : 'N/A';
}

// Contract-unknown rows render exactly what was stored: no unit, no rescaling,
// no reformatting that would imply a precision or scale the record never had.
export function formatStoredScore(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? String(numericValue) : 'N/A';
}

export function formatSnapshotDate(value) {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

// Completeness-aware wording: fewer rows than the endpoint cap proves the set
// is complete; a full page of exactly HISTORY_LIMIT rows may be truncated, so
// the label must not claim a total.
export function historyCountLabel(count) {
  if (count === 0) {
    return 'No saved similarity checks';
  }

  if (count >= HISTORY_LIMIT) {
    return `Latest ${HISTORY_LIMIT} saved checks`;
  }

  return count === 1 ? '1 saved check' : `${count} saved checks`;
}

export function historyListingSentence(count) {
  if (count === 0) {
    return '';
  }

  return count >= HISTORY_LIMIT
    ? 'Every loaded check is listed separately.'
    : 'Every saved check shown here is listed separately.';
}

function tierCountsLine(resultSummary) {
  const tierCounts = resultSummary?.tierCounts;

  if (!tierCounts) {
    return null;
  }

  const asCount = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  return `Historical ${asCount(tierCounts.historical)} · current ${asCount(tierCounts.currentSession)} · under review ${asCount(tierCounts.underReview)}`;
}

function RegisterRow({ snapshot }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isCurrentContract = snapshot.scoring_contract === VOYAGE_RAW_COSINE_CONTRACT;
  const tiers = tierCountsLine(snapshot.result_summary);
  const checkedByName = snapshot.checked_by?.name || 'Unknown lecturer';

  return (
    <li className="py-2" data-testid={`register-row-${snapshot.id}`}>
      <div className="grid grid-cols-[minmax(7rem,auto)_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 lg:grid-cols-[10rem_minmax(0,1fr)_7.5rem_minmax(0,1fr)_10rem_auto]">
        <span className="text-[13.5px] text-text-secondary" data-testid={`register-checked-${snapshot.id}`}>
          {formatSnapshotDate(snapshot.created_at)}
        </span>

        {isCurrentContract ? (
          <span className="min-w-0">
            <SimilarityClassificationChip value={snapshot.overall_risk} data-testid={`register-class-${snapshot.id}`} />
          </span>
        ) : (
          /* The stored classification is preserved exactly as recorded, but its
             scoring contract is unknown, so it stays labelled as recorded
             metadata rather than presented as a current classification. It is
             never recomputed from the stored number. */
          <RecordedClassificationToken
            token={snapshot.overall_risk}
            data-testid={`snapshot-recorded-classification-${snapshot.id}`}
          />
        )}

        <span className="font-mono text-[13px] text-text-primary" data-testid={`snapshot-score-${snapshot.id}`}>
          {isCurrentContract
            ? `cosine ${formatCosineScore(snapshot.max_similarity)}`
            : formatStoredScore(snapshot.max_similarity)}
        </span>

        <span className="hidden text-[13.5px] text-text-secondary lg:block" data-testid={`register-tiers-${snapshot.id}`}>
          {tiers || '—'}
        </span>

        <span className="hidden truncate text-[13.5px] text-text-secondary lg:block" data-testid={`register-by-${snapshot.id}`}>
          {checkedByName}
        </span>

        <button
          type="button"
          className="justify-self-end text-[13.5px] font-medium text-text-primary underline underline-offset-2 hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
          data-testid={`register-toggle-${snapshot.id}`}
        >
          {isExpanded ? 'Hide details' : 'Details'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-1.5 border-l-2 border-border-subtle pl-3" data-testid={`register-details-${snapshot.id}`}>
          <p className="text-[13.5px] text-text-secondary lg:hidden">
            {tiers ? `Corpus tiers: ${tiers}` : 'Corpus tiers: not recorded'}
          </p>
          <p className="text-[13.5px] text-text-secondary lg:hidden">
            Checked by {checkedByName}
            {snapshot.checked_by?.email ? ` (${snapshot.checked_by.email})` : ''}
          </p>
          {snapshot.checked_by?.email && (
            <p className="hidden break-words text-[13.5px] text-text-secondary lg:block">
              Checked by {checkedByName} ({snapshot.checked_by.email})
            </p>
          )}
          <p className="text-[13.5px] text-text-secondary">
            Response status:{' '}
            <span className="rounded-badge bg-surface-muted px-2 py-0.5 text-[11.5px] font-semibold uppercase text-text-muted ring-1 ring-inset ring-border-subtle">
              {snapshot.response_status || 'N/A'}
            </span>
          </p>
          <p className="text-[13.5px] leading-5 text-text-secondary">
            {snapshot.recommendation || 'No recommendation captured.'}
          </p>
          {!isCurrentContract && snapshot.max_similarity != null && (
            <p className="text-[13.5px] leading-5 text-text-muted" data-testid={`snapshot-contract-note-${snapshot.id}`}>
              Historical scoring contract not recorded. This value is shown as stored and is not directly comparable with current cosine scores.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

RegisterRow.propTypes = {
  snapshot: PropTypes.object.isRequired
};

/**
 * SimilarityEvidenceHistoryRegister
 *
 * The lecturer similarity-snapshot history as a compact register: one row per
 * saved check, keyed by snapshot id. Compression is row height only — rows are
 * never grouped, merged, deduplicated or collapsed by timestamp, so
 * duplicate-looking rows (F-2) stay separately visible. Fields that do not fit
 * the dense row (response status, recommendation, checker email, and the
 * contract-unknown caveat) remain available through each row's keyboard-
 * operable disclosure; on narrow viewports the tier counts and author move
 * into the disclosure rather than being dropped.
 */
function SimilarityEvidenceHistoryRegister({ snapshots }) {
  return (
    <div data-testid="history-register">
      <div className="hidden grid-cols-[10rem_minmax(0,1fr)_7.5rem_minmax(0,1fr)_10rem_auto] gap-x-3 border-b border-border-strong pb-1.5 text-[11.5px] font-medium uppercase tracking-[0.08em] text-text-muted lg:grid">
        <span>Checked</span>
        <span>Classification</span>
        <span>Score</span>
        <span>Corpus tiers</span>
        <span>By</span>
        <span aria-hidden="true" />
      </div>
      <ol className="divide-y divide-border-subtle">
        {snapshots.map((snapshot) => (
          <RegisterRow key={snapshot.id} snapshot={snapshot} />
        ))}
      </ol>
    </div>
  );
}

SimilarityEvidenceHistoryRegister.propTypes = {
  snapshots: PropTypes.arrayOf(PropTypes.object).isRequired
};

export default SimilarityEvidenceHistoryRegister;
