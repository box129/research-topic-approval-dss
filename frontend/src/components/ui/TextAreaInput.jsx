import PropTypes from 'prop-types';

function TextAreaInput({
  error,
  helperText,
  id,
  label,
  required = false,
  rows = 4,
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
      <textarea
        id={inputId}
        rows={rows}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={[
          'mt-2 w-full resize-y rounded-input border bg-white px-3 py-2 text-sm text-text-primary shadow-card transition-colors',
          'placeholder:text-text-muted focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/20',
          'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-text-muted',
          error ? 'border-feedback-danger' : 'border-border-strong',
          className
        ].filter(Boolean).join(' ')}
        {...props}
      />
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="mt-1 text-sm text-text-muted">{helperText}</p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-feedback-danger">{error}</p>
      )}
    </label>
  );
}

TextAreaInput.propTypes = {
  className: PropTypes.string,
  error: PropTypes.string,
  helperText: PropTypes.string,
  id: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string,
  required: PropTypes.bool,
  rows: PropTypes.number
};

export default TextAreaInput;
