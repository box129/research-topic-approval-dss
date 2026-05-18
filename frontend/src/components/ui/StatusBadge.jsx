import PropTypes from 'prop-types';

const STATUS_CLASSES = {
  pending: 'bg-blue-100 text-blue-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  awaiting_revision: 'bg-amber-100 text-amber-800',
  not_submitted: 'bg-gray-100 text-gray-700'
};

function StatusBadge({ status = 'pending' }) {
  const normalized = String(status).toLowerCase();
  const label = normalized.replaceAll('_', ' ');

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_CLASSES[normalized] || STATUS_CLASSES.pending}`}>
      {label}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string
};

export default StatusBadge;
