import PropTypes from 'prop-types';

const VARIANT_CLASSES = {
  info: 'border-feedback-info-border bg-feedback-info-bg text-feedback-info',
  success: 'border-feedback-success-border bg-feedback-success-bg text-feedback-success',
  warning: 'border-feedback-warning-border bg-feedback-warning-bg text-feedback-warning',
  danger: 'border-feedback-danger-border bg-feedback-danger-bg text-feedback-danger'
};

function InfoCallout({ children, className = '', message, role, title, variant = 'info' }) {
  const semanticRole = role === null
    ? undefined
    : role || (variant === 'danger' ? 'alert' : variant === 'success' ? 'status' : undefined);
  return (
    <div role={semanticRole} aria-live={semanticRole === 'status' ? 'polite' : undefined} className={[
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
  role: PropTypes.oneOf([null, 'alert', 'status']),
  title: PropTypes.string,
  variant: PropTypes.oneOf(['info', 'success', 'warning', 'danger'])
};

export default InfoCallout;
