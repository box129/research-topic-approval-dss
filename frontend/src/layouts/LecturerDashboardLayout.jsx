import PropTypes from 'prop-types';

function LecturerDashboardLayout({ children, className = '' }) {
  return (
    <div className={[
      'relative isolate -mx-2 -my-2 min-h-[calc(100vh-7rem)] overflow-hidden rounded-[1.75rem] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.74),rgba(241,248,236,0.96))] p-4 shadow-[0_30px_90px_-65px_rgb(6_95_70_/_0.7)] sm:-mx-3 sm:p-6 lg:p-8',
      className
    ].filter(Boolean).join(' ')}>
      <div aria-hidden="true" className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-100/45 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-28 -left-20 h-56 w-56 rounded-full bg-amber-100/30 blur-3xl" />
      <div className="relative z-10 space-y-7">
        {children}
      </div>
    </div>
  );
}

LecturerDashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

export default LecturerDashboardLayout;
