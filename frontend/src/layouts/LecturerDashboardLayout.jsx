import PropTypes from 'prop-types';

function LecturerDashboardLayout({ children, className = '' }) {
  return (
    <div className={['space-y-6', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

LecturerDashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

export default LecturerDashboardLayout;
