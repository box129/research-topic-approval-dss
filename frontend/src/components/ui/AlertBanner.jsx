import PropTypes from 'prop-types';

const VARIANT_CLASSES = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900'
};

function AlertBanner({ variant = 'info', message }) {
  return (
    <div className={`rounded-lg border p-4 text-sm ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.info}`}>
      {message}
    </div>
  );
}

AlertBanner.propTypes = {
  variant: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  message: PropTypes.string.isRequired
};

export default AlertBanner;
