import PropTypes from 'prop-types';

function EmptyStatePanel({ action, className = '', message, title }) {
  return (
    <div className={[
      'rounded-card border border-dashed border-border-strong bg-white p-8 text-center shadow-card',
      className
    ].filter(Boolean).join(' ')}>
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      {message && <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

EmptyStatePanel.propTypes = {
  action: PropTypes.node,
  className: PropTypes.string,
  message: PropTypes.string,
  title: PropTypes.string.isRequired
};

export default EmptyStatePanel;
