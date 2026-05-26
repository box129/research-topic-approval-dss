import PropTypes from 'prop-types';

function AuthSplitLayout({ children, className = '', hero, footer }) {
  return (
    <div className={['min-h-screen bg-surface-page px-5 py-10', className].filter(Boolean).join(' ')}>
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-card border border-border-subtle bg-white shadow-card lg:grid-cols-[1fr_420px]">
        <section className="bg-brand-green p-8 text-white">
          {hero}
        </section>
        <section className="p-8">
          {children}
          {footer && <div className="mt-6">{footer}</div>}
        </section>
      </div>
    </div>
  );
}

AuthSplitLayout.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  footer: PropTypes.node,
  hero: PropTypes.node.isRequired
};

export default AuthSplitLayout;
