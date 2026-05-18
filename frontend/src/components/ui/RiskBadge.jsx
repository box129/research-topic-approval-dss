import PropTypes from 'prop-types';

const RISK_CLASSES = {
  LOW: 'bg-emerald-100 text-emerald-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-red-100 text-red-800'
};

function RiskBadge({ level = 'LOW' }) {
  const normalized = String(level).toUpperCase();

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${RISK_CLASSES[normalized] || RISK_CLASSES.LOW}`}>
      {normalized}
    </span>
  );
}

RiskBadge.propTypes = {
  level: PropTypes.oneOf(['LOW', 'MEDIUM', 'HIGH'])
};

export default RiskBadge;
