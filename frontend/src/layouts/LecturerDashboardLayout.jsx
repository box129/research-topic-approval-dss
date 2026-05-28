import PropTypes from 'prop-types';

function LecturerDashboardLayout({ children, className = '' }) {
  return (
    <div className={[
      '-mx-2 -my-2 min-h-[calc(100vh-7rem)] space-y-7 rounded-[1.5rem] bg-[#f1f8ec] p-4 sm:-mx-3 sm:p-6 lg:p-8',
      className
    ].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

LecturerDashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

export default LecturerDashboardLayout;
