import PropTypes from 'prop-types';

function LecturerDashboardLayout({ children, className = '' }) {
  return (
    <div className={[
      'workspace-record space-y-5',
      className
    ].filter(Boolean).join(' ')}>
      <div className="space-y-5">
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
