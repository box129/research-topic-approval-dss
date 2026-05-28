import PropTypes from 'prop-types';
import { Outlet } from 'react-router-dom';
import AuthenticatedTopNav from './AuthenticatedTopNav';

function AppLayout({ role }) {
  return (
    <div className="min-h-screen bg-[#eef7e8]">
      <AuthenticatedTopNav role={role} />
      <main className="mx-auto w-full max-w-[78rem] px-4 py-8 sm:px-6 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}

AppLayout.propTypes = {
  role: PropTypes.oneOf(['lecturer', 'student', 'admin']).isRequired
};

export default AppLayout;
