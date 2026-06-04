import PropTypes from 'prop-types';

function PageHeader({ action, eyebrow, subtitle, title }) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border-subtle pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">{eyebrow}</p>}
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl whitespace-normal break-keep text-left text-sm tracking-normal text-text-secondary hyphens-none [word-spacing:normal]">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

PageHeader.propTypes = {
  action: PropTypes.node,
  eyebrow: PropTypes.string,
  subtitle: PropTypes.string,
  title: PropTypes.string.isRequired
};

export default PageHeader;
