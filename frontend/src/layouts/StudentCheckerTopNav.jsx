import AuthenticatedTopNav from './AuthenticatedTopNav';

// Compatibility export retained for focused checker tests and downstream imports.
function StudentCheckerTopNav() {
  return <AuthenticatedTopNav role="student" />;
}

export default StudentCheckerTopNav;
