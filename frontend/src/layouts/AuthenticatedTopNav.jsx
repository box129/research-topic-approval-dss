import PropTypes from 'prop-types';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { roleLabels, roleNavigation } from './navigation';

function AuthenticatedTopNav({ role }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const items = roleNavigation[role] || [];
  const roleLabel = roleLabels[role];
  const displayName = user?.name || roleLabel;
  const initials = displayName?.slice(0, 1) || 'U';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="relative z-20 border-b border-emerald-950/20 bg-emerald-900 text-white shadow-lg shadow-emerald-950/10">
      <div className="mx-auto flex min-h-16 w-full max-w-[78rem] flex-col gap-3 px-4 py-3 sm:px-6 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white text-xs font-black text-emerald-900">
              U
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black leading-tight">UNIOSUN</p>
              <p className="text-[0.68rem] font-semibold leading-tight text-emerald-50">
                Research Similarity System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 xl:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-emerald-950">
              {initials}
            </div>
          </div>
        </div>

        <nav
          aria-label={`${roleLabel} navigation`}
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:flex-wrap md:justify-center md:overflow-visible xl:mx-0 xl:min-w-0 xl:flex-1 xl:flex-nowrap xl:pb-0"
        >
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => [
                'relative flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-emerald-800 text-amber-300 after:absolute after:inset-x-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-amber-400'
                  : 'text-emerald-50 hover:bg-white/10 hover:text-white'
              ].join(' ')}
            >
              <span>{item.label}</span>
              {item.soon && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-50">
                  Soon
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 xl:flex">
          <div className="text-right">
            <p className="text-sm font-bold leading-tight">{displayName}</p>
            <p className="text-[0.68rem] font-semibold leading-tight text-emerald-100">
              {roleLabel}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-emerald-950">
            {initials}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md px-3 py-2 text-sm font-semibold text-emerald-50 transition-colors hover:bg-white/10 hover:text-white"
          >
            Logout
          </button>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-fit rounded-md px-3 py-2 text-sm font-semibold text-emerald-50 transition-colors hover:bg-white/10 hover:text-white xl:hidden"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

AuthenticatedTopNav.propTypes = {
  role: PropTypes.oneOf(['lecturer', 'student', 'admin']).isRequired
};

export default AuthenticatedTopNav;
