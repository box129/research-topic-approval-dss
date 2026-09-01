import PropTypes from 'prop-types';

// Board A classification ramp (frozen): one neutral hue, three fill weights —
// filled ink / tinted / outline — plus a dashed outline for "not classified".
// Similarity classification is its own semantic family: it is never a workflow
// status and never wears approval green, revision amber or rejection red. The
// ramp stays distinguishable in greyscale and by label alone.
const CLASSIFICATIONS = {
  HIGH: {
    label: 'Higher similarity',
    chipClass: 'border border-text-primary bg-text-primary text-white'
  },
  MEDIUM: {
    label: 'Moderate similarity',
    chipClass: 'border border-border-strong bg-surface-muted text-text-primary'
  },
  LOW: {
    label: 'Lower similarity',
    chipClass: 'border border-border-strong bg-white text-text-primary'
  },
  NOT_CLASSIFIED: {
    label: 'Not classified',
    chipClass: 'border border-dashed border-border-strong bg-white text-text-secondary'
  }
};

// The only valid semantic values. Anything else — missing, unknown, malformed —
// degrades truthfully to "Not classified". The chip never infers a
// classification from a numeric score; the backend classification is the
// single authority (N-3).
export function normalizeClassification(value) {
  const normalized = String(value || '').toUpperCase();
  return CLASSIFICATIONS[normalized] ? normalized : 'NOT_CLASSIFIED';
}

export function classificationLabel(value) {
  return CLASSIFICATIONS[normalizeClassification(value)].label;
}

/**
 * SimilarityClassificationChip
 *
 * Narrow-contract primitive for the similarity-classification semantic family
 * only (LOW / MEDIUM / HIGH / NOT_CLASSIFIED). Not a workflow badge and not a
 * risk indicator. Plain-language label first at 14px; the raw API token second
 * as a subordinate mono chip at 12.5px when `showToken` is set.
 */
function SimilarityClassificationChip({ value, showToken = false, ...rest }) {
  const normalized = normalizeClassification(value);
  const { label, chipClass } = CLASSIFICATIONS[normalized];
  const token = normalized === 'NOT_CLASSIFIED' ? 'NOT CLASSIFIED' : normalized;

  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-classification={normalized} {...rest}>
      <span className={`inline-flex items-center rounded-[5px] px-2.5 py-0.5 text-[14px] font-medium leading-6 ${chipClass}`}>
        {label}
      </span>
      {showToken && (
        <span className="inline-flex items-center rounded-[5px] border border-border-subtle bg-white px-1.5 py-0.5 font-mono text-[12.5px] leading-5 text-text-secondary">
          {token}
        </span>
      )}
    </span>
  );
}

SimilarityClassificationChip.propTypes = {
  value: PropTypes.string,
  showToken: PropTypes.bool
};

export default SimilarityClassificationChip;
