import PropTypes from 'prop-types';

const RISK_CLASSES = {
  LOW: 'bg-risk-low-bg text-risk-low',
  MEDIUM: 'bg-risk-medium-bg text-risk-medium',
  HIGH: 'bg-risk-high-bg text-risk-high'
};

function RiskBadge({ level = 'LOW' }) {
  const normalized = String(level).toUpperCase();

  return (
    <span className={`inline-flex rounded-badge px-3 py-1 text-xs font-semibold ${RISK_CLASSES[normalized] || RISK_CLASSES.LOW}`}>
      {normalized}
    </span>
  );
}

RiskBadge.propTypes = {
  level: PropTypes.string
};

export default RiskBadge;
