import PropTypes from 'prop-types';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

function AppLayout({ role }) {
  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Sidebar role={role} />
      <div className="min-w-0 flex-1">
        <Topbar role={role} />
        <main className="mx-auto max-w-7xl px-5 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

AppLayout.propTypes = {
  role: PropTypes.oneOf(['lecturer', 'student', 'admin']).isRequired
};

export default AppLayout;
