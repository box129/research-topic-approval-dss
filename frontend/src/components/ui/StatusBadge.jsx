import PropTypes from 'prop-types';

// Family B — submission workflow status only (frozen Board D). This pill says
// where a real submission stands and nothing else: repository lifecycle
// buckets, account state, import/invitation state, and similarity
// classification each have their own treatments and must never route through
// this component. Stored/API tokens are never mutated here; labels are the
// user-facing sentence-case vocabulary. Unknown or future tokens fall back to
// the neutral treatment so an unmapped status can never borrow approval,
// revision, or rejection semantics.
const STATUS_PRESENTATION = {
  pending: { label: 'Pending review', className: 'bg-status-pending-bg text-status-pending' },
  pending_review: { label: 'Pending review', className: 'bg-status-pending-bg text-status-pending' },
  approved: { label: 'Approved', className: 'bg-status-approved-bg text-status-approved' },
  awaiting_revision: { label: 'Revision requested', className: 'bg-status-revision-bg text-status-revision' },
  rejected: { label: 'Rejected', className: 'bg-status-rejected-bg text-status-rejected' },
  not_submitted: { label: 'Not submitted', className: 'bg-status-neutral-bg text-status-neutral' }
};

const NEUTRAL_FALLBACK_CLASS = STATUS_PRESENTATION.not_submitted.className;

function fallbackLabel(normalized) {
  const spaced = normalized.replaceAll('_', ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function StatusBadge({ status = 'pending' }) {
  const normalized = String(status).toLowerCase();
  const presentation = STATUS_PRESENTATION[normalized];

  return (
    <span className={`inline-flex whitespace-nowrap rounded-badge px-3 py-1 text-sm font-semibold ${presentation ? presentation.className : NEUTRAL_FALLBACK_CLASS}`}>
      {presentation ? presentation.label : fallbackLabel(normalized)}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string
};

export default StatusBadge;
