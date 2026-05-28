import PropTypes from 'prop-types';

function AuthSplitLayout({ children, className = '', hero, footer }) {
  return (
    <div className={['min-h-screen overflow-x-hidden bg-[#202020] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10', className].filter(Boolean).join(' ')}>
      <div className="mx-auto grid min-h-[min(760px,calc(100vh-4rem))] w-full max-w-6xl overflow-hidden bg-white shadow-[0_28px_80px_-30px_rgb(0_0_0_/_0.7)] lg:grid-cols-[0.86fr_1fr]">
        <section className="relative overflow-hidden bg-[#145f24] p-8 text-white sm:p-10 lg:p-12">
          <div aria-hidden="true" className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[42px] border-white/5" />
          <div aria-hidden="true" className="absolute right-0 top-0 h-48 w-64 bg-white/5 blur-3xl" />
          <div className="relative z-10 h-full">
            {hero}
          </div>
        </section>
        <section className="flex items-center bg-white p-8 sm:p-10 lg:px-20 lg:py-16">
          <div className="mx-auto w-full max-w-[430px]">
            {children}
            {footer && <div className="mt-6">{footer}</div>}
          </div>
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
