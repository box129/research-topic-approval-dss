import PropTypes from 'prop-types';

function StudentDashboardLayout({ children, className = '' }) {
  return (
    <div className={[
      'mx-auto w-full max-w-[70rem] space-y-8 rounded-[2rem] bg-[#f3faee]/80 px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10',
      className
    ].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

StudentDashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

export default StudentDashboardLayout;
