import PropTypes from 'prop-types';

const VARIANT_CLASSES = {
  info: 'border-feedback-info-border bg-feedback-info-bg text-feedback-info',
  success: 'border-feedback-success-border bg-feedback-success-bg text-feedback-success',
  warning: 'border-feedback-warning-border bg-feedback-warning-bg text-feedback-warning',
  danger: 'border-feedback-danger-border bg-feedback-danger-bg text-feedback-danger'
};

function InfoCallout({ children, className = '', message, title, variant = 'info' }) {
  return (
    <div className={[
      'rounded-card border p-4 text-sm',
      VARIANT_CLASSES[variant] || VARIANT_CLASSES.info,
      className
    ].filter(Boolean).join(' ')}>
      {title && <p className="font-semibold">{title}</p>}
      {message && <p className={title ? 'mt-1' : ''}>{message}</p>}
      {children && <div className={title || message ? 'mt-2' : ''}>{children}</div>}
    </div>
  );
}

InfoCallout.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  message: PropTypes.string,
  title: PropTypes.string,
  variant: PropTypes.oneOf(['info', 'success', 'warning', 'danger'])
};

export default InfoCallout;
