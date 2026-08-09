import PropTypes from 'prop-types';

function LoadingStatePanel({ className = '', label = 'Loading...' }) {
  return (
    <div role="status" aria-live="polite" className={[
      'rounded-card border border-border-subtle bg-white p-6 shadow-card',
      className
    ].filter(Boolean).join(' ')}>
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <span aria-hidden="true" className="h-3 w-3 animate-pulse rounded-full bg-brand-green" />
        {label}
      </div>
    </div>
  );
}

LoadingStatePanel.propTypes = {
  className: PropTypes.string,
  label: PropTypes.string
};

export default LoadingStatePanel;
