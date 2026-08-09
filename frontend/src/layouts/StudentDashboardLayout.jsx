import PropTypes from 'prop-types';

function StudentDashboardLayout({ children, className = '' }) {
  return (
    <div className={['workspace-record space-y-5', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

StudentDashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export default StudentDashboardLayout;
