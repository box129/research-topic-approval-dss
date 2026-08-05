import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import NotificationCenter from './NotificationCenter';
import { studentCheckerHomePath, studentCheckerNavigationGroups } from './navigation';

function StudentCheckerTopNav() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef(null);
  const navRef = useRef(null);
  const displayName = user?.name || 'Student';

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    navRef.current?.querySelector('a, button')?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) requestAnimationFrame(() => toggleRef.current?.focus());
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[70] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-bold focus:text-emerald-900 focus:shadow-lg"
      >
        Skip to main content
      </a>
      <header className="relative z-30 border-b border-emerald-950/20 bg-brand-green-dark text-white">
        <div className="mx-auto flex min-h-16 w-full max-w-[76rem] items-center gap-3 px-4 py-2 sm:px-6">
          <NavLink to={studentCheckerHomePath} aria-label="Research Topic Approval DSS home" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/30 bg-white text-xs font-black text-brand-green-dark">RT</span>
            <span className="min-w-0">
              <strong className="hidden text-sm leading-tight sm:block">Research Topic Approval DSS</strong>
              <strong className="block text-sm leading-tight sm:hidden">Approval DSS</strong>
              <small className="hidden text-xs text-emerald-100 min-[430px]:block">Authenticated workspace</small>
            </span>
          </NavLink>
          <span data-testid="student-role" className="border-l border-white/25 pl-3 text-sm font-bold min-[901px]:ml-1 min-[901px]:pl-4">Student</span>
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={isOpen}
            aria-controls="student-target-navigation"
            onClick={() => setIsOpen((current) => !current)}
            className="ml-auto min-h-11 rounded-md border border-white/30 px-4 text-sm font-bold min-[901px]:hidden"
          >
            {isOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav
          ref={navRef}
          id="student-target-navigation"
          aria-label="Student navigation"
          className={`${isOpen ? 'block' : 'hidden'} border-t border-white/15 bg-emerald-950 min-[901px]:block`}
        >
          <div className="relative mx-auto grid w-full max-w-[76rem] gap-5 px-4 py-4 sm:px-6 min-[901px]:grid-cols-[auto_auto_auto] min-[901px]:items-start min-[901px]:pr-80 min-[901px]:py-3">
            {studentCheckerNavigationGroups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1 min-[901px]:flex-row min-[901px]:items-center min-[901px]:gap-2">
                <span className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-200 min-[901px]:mb-0">{group.label}</span>
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => closeMenu()}
                    className={({ isActive }) => `min-h-10 rounded-md px-3 py-2 text-sm font-semibold ${isActive ? 'bg-white text-brand-green-dark underline decoration-2 underline-offset-4' : 'text-emerald-50 hover:bg-white/10'}`}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
            <div className="border-t border-white/15 pt-4 min-[901px]:absolute min-[901px]:-top-[4.15rem] min-[901px]:right-6 min-[901px]:flex min-[901px]:items-center min-[901px]:gap-3 min-[901px]:border-0 min-[901px]:pt-0">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-200 min-[901px]:sr-only">Account and session</p>
              <p className="mb-3 text-sm font-semibold min-[901px]:mb-0 min-[901px]:max-w-36 min-[901px]:truncate">{displayName} · Student account</p>
              <div className="flex flex-wrap items-center gap-3">
                <NotificationCenter />
                <button data-testid="student-logout" type="button" onClick={handleLogout} className="min-h-11 rounded-md border border-white/30 px-4 text-sm font-bold">Logout</button>
                <button type="button" onClick={() => closeMenu(true)} className="min-h-11 px-2 text-sm font-bold text-emerald-100 min-[901px]:hidden">Close menu</button>
              </div>
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}

export default StudentCheckerTopNav;
