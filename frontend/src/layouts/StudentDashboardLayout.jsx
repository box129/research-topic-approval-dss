import PropTypes from 'prop-types';

function StudentDashboardLayout({ children, className = '' }) {
  return (
    <div className={[
      'relative isolate mx-auto w-full max-w-[70rem] overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.72),rgba(243,250,238,0.94))] px-4 py-6 shadow-[0_30px_90px_-65px_rgb(6_95_70_/_0.7)] sm:px-7 sm:py-8 lg:px-10 lg:py-10',
      className
    ].filter(Boolean).join(' ')}>
      <div aria-hidden="true" className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-100/45 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-28 -left-20 h-56 w-56 rounded-full bg-amber-100/35 blur-3xl" />
      <div className="relative z-10 space-y-8">
        {children}
      </div>
    </div>
  );
}

StudentDashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

export default StudentDashboardLayout;
