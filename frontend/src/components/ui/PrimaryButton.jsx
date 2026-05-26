import PropTypes from 'prop-types';

function PrimaryButton({
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
        'inline-flex items-center justify-center rounded-input bg-brand-green px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors',
        'hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 disabled:shadow-none',
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

PrimaryButton.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  fullWidth: PropTypes.bool,
  isLoading: PropTypes.bool,
  type: PropTypes.oneOf(['button', 'submit', 'reset'])
};

export default PrimaryButton;
