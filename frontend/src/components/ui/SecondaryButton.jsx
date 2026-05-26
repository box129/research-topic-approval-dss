import PropTypes from 'prop-types';

function SecondaryButton({
  children,
  className = '',
  disabled = false,
  fullWidth = false,
  isLoading = false,
  type = 'button',
  ...props
}) {
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center rounded-input border border-border-strong bg-white px-4 py-2 text-sm font-semibold text-text-secondary shadow-card transition-colors',
        'hover:bg-surface-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none',
        widthClass,
        className
      ].filter(Boolean).join(' ')}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
}

SecondaryButton.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  fullWidth: PropTypes.bool,
  isLoading: PropTypes.bool,
  type: PropTypes.oneOf(['button', 'submit', 'reset'])
};

export default SecondaryButton;
