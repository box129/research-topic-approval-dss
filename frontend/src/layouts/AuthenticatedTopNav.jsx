import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { roleLabels, roleNavigation } from './navigation';
import NotificationCenter from './NotificationCenter';

const linkClasses = ({ isActive }) => [
  'flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold text-emerald-50 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 min-[1151px]:min-h-10 min-[1151px]:whitespace-nowrap',
  isActive ? 'bg-emerald-950/55 text-amber-300 underline decoration-2 underline-offset-4' : ''
].join(' ');

function NavigationLinks({ items, onNavigate }) {
  return items.map((item) => (
    <NavLink key={item.path} to={item.path} onClick={onNavigate} className={linkClasses}>
      {item.label}
    </NavLink>
  ));
}

function AuthenticatedTopNav({ role }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef(null);
  const mobileNavRef = useRef(null);
  const roleLabel = roleLabels[role];
  const items = roleNavigation[role] || [];
  const displayName = user?.name || roleLabel;
  const initial = displayName.slice(0, 1).toUpperCase();
  const isStudent = role === 'student';

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    mobileNavRef.current?.querySelector('a, button')?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[70] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-bold focus:text-emerald-900 focus:shadow-lg">
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 border-b border-emerald-950/20 bg-brand-green-dark text-white shadow-sm">
        <div className="workspace-console flex min-h-[3.75rem] items-center gap-3 px-4 py-2 sm:px-6">
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={isOpen}
            aria-controls={`${role}-mobile-navigation`}
            aria-label={isOpen ? 'Close menu' : 'Menu'}
            onClick={() => setIsOpen((current) => !current)}
            className="min-h-11 shrink-0 rounded-md border border-white/25 px-3 text-sm font-bold hover:bg-white/10 min-[1151px]:hidden"
          >
            {isOpen ? 'Close' : 'Menu'}
          </button>
          <NavLink to={`/${role}/dashboard`} aria-label="Research Topic Approval DSS home" className="flex min-w-0 shrink-0 items-center gap-2 no-underline">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-brand-green-dark">U</span>
            <span className="min-w-0">
              <strong className="block text-sm font-extrabold leading-tight">UNIOSUN</strong>
              <small className="hidden truncate text-xs text-emerald-100 sm:block">Research Topic Approval DSS</small>
              <small className="block truncate text-xs text-emerald-100 sm:hidden">Approval DSS</small>
            </span>
          </NavLink>

          {isStudent ? (
            <nav aria-label="Student navigation" className="hidden min-w-0 flex-1 items-center gap-1 min-[1151px]:flex">
              <NavigationLinks items={items} onNavigate={() => closeMenu()} />
            </nav>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <NotificationCenter />
            <div className="hidden items-center gap-2 border-l border-white/20 pl-3 min-[1151px]:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-emerald-950">{initial}</span>
              <span data-testid={`${role}-account`} className={`${isStudent ? 'max-w-56' : 'max-w-72'} truncate text-sm font-semibold`}>
                {displayName} · <span data-testid={role === 'student' ? 'student-role' : undefined}>{roleLabel}</span>
              </span>
              <button data-testid={`${role}-logout`} type="button" onClick={handleLogout} className="min-h-10 rounded-md border border-white/25 px-3 text-sm font-semibold hover:bg-white/10">Log out</button>
            </div>
          </div>
        </div>

        {!isStudent ? (
          <nav aria-label={`${roleLabel} navigation`} className="hidden border-t border-white/15 min-[1151px]:block">
            <div className="workspace-console flex items-center gap-1 px-4 py-1.5 sm:px-6">
              <NavigationLinks items={items} onNavigate={() => closeMenu()} />
            </div>
          </nav>
        ) : null}

        <nav
          ref={mobileNavRef}
          id={`${role}-mobile-navigation`}
          aria-label={`${roleLabel} mobile navigation`}
          className={`${isOpen ? 'block' : 'hidden'} border-t border-white/15 min-[1151px]:hidden`}
        >
          <div className="workspace-console flex flex-col gap-1 px-4 py-2 sm:px-6">
            <NavigationLinks items={items} onNavigate={() => closeMenu()} />
            <div className="mt-2 border-t border-white/15 pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">Account and session</p>
              <p className="mt-2 break-words text-sm font-semibold text-white">{displayName} · {roleLabel}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button data-testid={`${role}-mobile-logout`} type="button" onClick={handleLogout} className="min-h-11 rounded-md border border-white/30 px-4 text-sm font-bold">Log out</button>
              </div>
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}

NavigationLinks.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string.isRequired, path: PropTypes.string.isRequired })).isRequired,
  onNavigate: PropTypes.func.isRequired
};

AuthenticatedTopNav.propTypes = {
  role: PropTypes.oneOf(['lecturer', 'student', 'admin']).isRequired
};

export default AuthenticatedTopNav;
