import PropTypes from 'prop-types';
import MetricCard from './MetricCard';

function StatCard({ label, value, helper }) {
  return <MetricCard label={label} value={value} helper={helper} />;
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  helper: PropTypes.string
};

export default StatCard;
