import PropTypes from 'prop-types';
import { Outlet, useLocation } from 'react-router-dom';
import AuthenticatedTopNav from './AuthenticatedTopNav';
import StudentCheckerTopNav from './StudentCheckerTopNav';

function AppLayout({ role }) {
  const location = useLocation();
  const normalizedPathname = location.pathname.replace(/\/+$/, '') || '/';
  const isStudentCheckerTarget = role === 'student'
    && normalizedPathname === '/student/check-my-topic';

  return (
    <div className={isStudentCheckerTarget ? 'min-h-screen bg-surface-page' : 'min-h-screen bg-[#eef7e8]'}>
      {isStudentCheckerTarget
        ? <StudentCheckerTopNav />
        : <AuthenticatedTopNav role={role} />}
      <main
        id={isStudentCheckerTarget ? 'main-content' : undefined}
        tabIndex={isStudentCheckerTarget ? -1 : undefined}
        className={isStudentCheckerTarget
          ? 'mx-auto w-full max-w-[76rem] px-4 py-6 sm:px-6 lg:py-8'
          : 'mx-auto w-full max-w-[78rem] px-4 py-8 sm:px-6 lg:py-10'}
      >
        <Outlet />
      </main>
      {isStudentCheckerTarget && (
        <footer className="mx-auto flex w-full max-w-[76rem] flex-col gap-1 border-t border-border-subtle px-4 py-5 text-sm text-text-secondary sm:flex-row sm:justify-between sm:px-6">
          <span>Research Topic Approval DSS</span>
          <span>Authenticated student workspace</span>
        </footer>
      )}
    </div>
  );
}

AppLayout.propTypes = {
  role: PropTypes.oneOf(['lecturer', 'student', 'admin']).isRequired
};

export default AppLayout;
