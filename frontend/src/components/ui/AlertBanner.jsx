import PropTypes from 'prop-types';

const VARIANT_CLASSES = {
  info: 'border-feedback-info-border bg-feedback-info-bg text-feedback-info',
  success: 'border-feedback-success-border bg-feedback-success-bg text-feedback-success',
  warning: 'border-feedback-warning-border bg-feedback-warning-bg text-feedback-warning',
  error: 'border-feedback-danger-border bg-feedback-danger-bg text-feedback-danger'
};

function AlertBanner({ variant = 'info', message }) {
  return (
    <div className={`rounded-card border p-4 text-sm ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.info}`}>
      {message}
    </div>
  );
}

AlertBanner.propTypes = {
  variant: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  message: PropTypes.string.isRequired
};

export default AlertBanner;
