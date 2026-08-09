import PropTypes from 'prop-types';

function AdminDashboardLayout({ children, className = '' }) {
  return (
    <div className={['workspace-console space-y-5', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

AdminDashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

export default AdminDashboardLayout;
