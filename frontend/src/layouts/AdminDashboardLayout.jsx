import PropTypes from 'prop-types';

function AdminDashboardLayout({ children, className = '' }) {
  return (
    <div className={['relative isolate space-y-6', className].filter(Boolean).join(' ')}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-72 overflow-hidden"
      >
        <div className="absolute -left-20 top-6 h-52 w-52 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute right-10 top-0 h-44 w-44 rounded-full bg-amber-100/55 blur-3xl" />
      </div>
      {children}
    </div>
  );
}

AdminDashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

export default AdminDashboardLayout;
