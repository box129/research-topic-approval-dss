import PropTypes from 'prop-types';

function SelectInput({
  children,
  error,
  helperText,
  id,
  label,
  options,
  placeholder,
  required = false,
  className = '',
  ...props
}) {
  const inputId = id || props.name;
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;

  return (
    <label className="block" htmlFor={inputId}>
      {label && (
        <span className="block text-sm font-medium text-text-primary">
          {label}
          {required && <span className="text-feedback-danger"> *</span>}
        </span>
      )}
      <select
        id={inputId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={[
          'mt-2 w-full rounded-input border bg-white px-3 py-2 text-sm text-text-primary shadow-card transition-colors',
          'focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/20',
          'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-text-muted',
          error ? 'border-feedback-danger' : 'border-border-strong',
          className
        ].filter(Boolean).join(' ')}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="mt-1 text-sm text-text-muted">{helperText}</p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-feedback-danger">{error}</p>
      )}
    </label>
  );
}

SelectInput.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  error: PropTypes.string,
  helperText: PropTypes.string,
  id: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.shape({
    disabled: PropTypes.bool,
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired
  })),
  placeholder: PropTypes.string,
  required: PropTypes.bool
};

export default SelectInput;
