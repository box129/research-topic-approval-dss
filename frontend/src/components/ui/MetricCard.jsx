import PropTypes from 'prop-types';

const TONE_CLASSES = {
  neutral: 'border-border-subtle bg-white text-text-primary',
  success: 'border-feedback-success-border bg-feedback-success-bg text-feedback-success',
  warning: 'border-feedback-warning-border bg-feedback-warning-bg text-feedback-warning',
  danger: 'border-feedback-danger-border bg-feedback-danger-bg text-feedback-danger',
  info: 'border-feedback-info-border bg-feedback-info-bg text-feedback-info'
};

function MetricCard({ helper, icon, label, tone = 'neutral', value }) {
  return (
    <article className={[
      'rounded-card border p-5 shadow-card',
      TONE_CLASSES[tone] || TONE_CLASSES.neutral
    ].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium opacity-80">{label}</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{value}</p>
        </div>
        {icon && <div className="text-text-muted">{icon}</div>}
      </div>
      {helper && <p className="mt-1 text-xs text-text-muted">{helper}</p>}
    </article>
  );
}

MetricCard.propTypes = {
  helper: PropTypes.string,
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(['neutral', 'success', 'warning', 'danger', 'info']),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired
};

export default MetricCard;
