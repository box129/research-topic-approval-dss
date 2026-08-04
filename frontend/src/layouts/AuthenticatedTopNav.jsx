import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { roleLabels, roleNavigation } from './navigation';
import NotificationCenter from './NotificationCenter';

function AuthenticatedTopNav({ role }) {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const items = roleNavigation[role] || [];
  const roleLabel = roleLabels[role];
  const displayName = user?.name || roleLabel;
  const initials = displayName?.slice(0, 1) || 'U';
  const navRef = useRef(null);
  const [navScrollState, setNavScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false
  });

  const updateNavScrollState = useCallback(() => {
    const nav = navRef.current;

    if (!nav) {
      return;
    }

    const edgeTolerance = 2;

    setNavScrollState({
      canScrollLeft: nav.scrollLeft > edgeTolerance,
      canScrollRight: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - edgeTolerance
    });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateNavScrollState);

    return () => {
      window.removeEventListener('resize', updateNavScrollState);
    };
  }, [updateNavScrollState]);

  useEffect(() => {
    const activeLink = navRef.current?.querySelector('[aria-current="page"]');

    activeLink?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest'
    });

    const animationFrame = window.requestAnimationFrame(updateNavScrollState);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [location.pathname, role, updateNavScrollState]);

  const scrollNavigation = (direction) => {
    const nav = navRef.current;

    nav?.scrollBy({
      left: direction * Math.max(nav.clientWidth * 0.72, 240),
      behavior: 'smooth'
    });
  };

  const hasScrollableNavigation =
    navScrollState.canScrollLeft || navScrollState.canScrollRight;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="relative z-20 border-b border-emerald-950/20 bg-[#1B5E20] text-white shadow-lg shadow-emerald-950/10">
      <div className="mx-auto flex min-h-16 w-full max-w-[78rem] flex-col gap-1.5 px-4 py-2 sm:px-6 xl:flex-row xl:items-center xl:justify-between xl:gap-6 xl:py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white text-xs font-black text-[#1B5E20]">
              U
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black leading-tight">UNIOSUN</p>
              <p className="text-[0.68rem] font-semibold leading-tight text-emerald-50">
                Research Similarity System
              </p>
            </div>
          </div>

        </div>

        <div className="relative min-w-0 xl:flex-1">
          <nav
            ref={navRef}
            id={`${role}-navigation-links`}
            aria-label={`${roleLabel} navigation`}
            onScroll={updateNavScrollState}
            className="-mx-1 flex scroll-smooth gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:mx-0 xl:min-w-0 xl:pb-0"
          >
            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => [
                  'relative flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors xl:px-2',
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

          {navScrollState.canScrollLeft && (
            <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#1B5E20] via-[#1B5E20]/90 to-transparent" />
          )}
          {navScrollState.canScrollRight && (
            <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#1B5E20] via-[#1B5E20]/90 to-transparent" />
          )}

          {navScrollState.canScrollLeft && (
            <button
              type="button"
              aria-label="Scroll navigation left"
              aria-controls={`${role}-navigation-links`}
              onClick={() => scrollNavigation(-1)}
              className="absolute left-0.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-[#1B5E20]/95 text-sm font-black text-white shadow transition-colors hover:bg-white/20"
            >
              &larr;
            </button>
          )}

          {navScrollState.canScrollRight && (
            <button
              type="button"
              aria-label="Scroll navigation right"
              aria-controls={`${role}-navigation-links`}
              onClick={() => scrollNavigation(1)}
              className="absolute right-0.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/70 bg-amber-400 text-sm font-black text-emerald-950 shadow transition-colors hover:bg-amber-300"
            >
              &rarr;
            </button>
          )}

          {hasScrollableNavigation && (
            <span className="sr-only">
              More navigation items are available horizontally.
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 xl:gap-3">
          <NotificationCenter />
          <div className="hidden text-right sm:block">
            <p className="max-w-40 truncate text-xs font-bold leading-tight xl:text-sm">{displayName}</p>
            <p className="text-[0.65rem] font-semibold leading-tight text-emerald-100 xl:text-[0.68rem]">
              {roleLabel}
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-emerald-950 xl:h-10 xl:w-10 xl:text-sm">
            {initials}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-white/15 px-2 py-1.5 text-xs font-semibold text-emerald-50 transition-colors hover:bg-white/10 hover:text-white sm:px-3 xl:border-transparent xl:px-3 xl:py-2 xl:text-sm"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

AuthenticatedTopNav.propTypes = {
  role: PropTypes.oneOf(['lecturer', 'student', 'admin']).isRequired
};

export default AuthenticatedTopNav;
