import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { roleLabels } from './navigation';

function Topbar({ role }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-950">Research Topic Approval</p>
          <p className="text-xs text-gray-500">{user?.name || roleLabels[role]}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm font-medium text-gray-600 hover:text-emerald-700"
          >
            Logout
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
            {(user?.name || roleLabels[role])?.slice(0, 1) || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}

Topbar.propTypes = {
  role: PropTypes.oneOf(['lecturer', 'student', 'admin']).isRequired
};

export default Topbar;
