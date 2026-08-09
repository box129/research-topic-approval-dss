import PropTypes from 'prop-types';

const STATUS_CLASSES = {
  pending: 'bg-status-pending-bg text-status-pending',
  pending_review: 'bg-status-pending-bg text-status-pending',
  approved: 'bg-status-approved-bg text-status-approved',
  rejected: 'bg-status-rejected-bg text-status-rejected',
  awaiting_revision: 'bg-status-revision-bg text-status-revision',
  not_submitted: 'bg-status-neutral-bg text-status-neutral'
};

function StatusBadge({ status = 'pending' }) {
  const normalized = String(status).toLowerCase();
  const label = normalized.replaceAll('_', ' ');

  return (
    <span className={`inline-flex rounded-badge px-3 py-1 text-xs font-semibold capitalize ${STATUS_CLASSES[normalized] || STATUS_CLASSES.not_submitted}`}>
      {label}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string
};

export default StatusBadge;
