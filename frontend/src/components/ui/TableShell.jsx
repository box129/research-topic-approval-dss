import PropTypes from 'prop-types';

function TableShell({ actions, children, className = '', subtitle, title }) {
  return (
    <section className={[
      'overflow-hidden rounded-card border border-border-subtle bg-white shadow-card',
      className
    ].filter(Boolean).join(' ')}>
      {(title || subtitle || actions) && (
        <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h2 className="text-base font-semibold text-text-primary">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>
      )}
      <div className="overflow-x-auto">
        {children}
      </div>
    </section>
  );
}

TableShell.propTypes = {
  actions: PropTypes.node,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  subtitle: PropTypes.string,
  title: PropTypes.string
};

export default TableShell;
