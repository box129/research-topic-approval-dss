import PropTypes from 'prop-types';
import { Outlet } from 'react-router-dom';
import AuthenticatedTopNav from './AuthenticatedTopNav';

function AppLayout({ role }) {
  return (
    <div className="authenticated-workspace flex min-h-screen flex-col bg-surface-page">
      <AuthenticatedTopNav role={role} />
      <main
        id="main-content"
        tabIndex={-1}
        className="workspace-console flex-1 px-4 py-7 sm:px-6 sm:py-8"
      >
        <Outlet />
      </main>
      <footer className="workspace-console flex flex-col gap-1 border-t border-border-subtle px-4 py-4 text-xs text-text-muted sm:flex-row sm:justify-between sm:px-6">
        <span>UNIOSUN Research Topic Approval DSS</span>
        <span>Authenticated {role === 'admin' ? 'administrator' : role} workspace</span>
      </footer>
    </div>
  );
}

AppLayout.propTypes = {
  role: PropTypes.oneOf(['lecturer', 'student', 'admin']).isRequired
};

export default AppLayout;
