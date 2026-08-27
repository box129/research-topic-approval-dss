import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthenticatedTopNav from '../src/layouts/AuthenticatedTopNav';
import StudentCheckerTopNav from '../src/layouts/StudentCheckerTopNav';
import { roleNavigation, deferredStudentNavigation, studentCheckerNavigationGroups } from '../src/layouts/navigation';

const logout = vi.fn();
vi.mock('../src/auth/useAuth', () => ({ useAuth: () => ({ logout, user: { name: 'Workspace User' } }) }));
vi.mock('../src/layouts/NotificationCenter', () => ({ default: () => <button data-testid="notification-center">Notifications</button> }));

function renderNav(role, path) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={<AuthenticatedTopNav role={role} />} /><Route path="/login" element={<div>Login screen</div>} /></Routes></MemoryRouter>);
}

describe('shared authenticated workspace navigation', () => {
  beforeEach(() => logout.mockReset());

  it('retains the StudentCheckerTopNav compatibility export and one notification owner', () => {
    render(<MemoryRouter initialEntries={['/student/check-my-topic']}><StudentCheckerTopNav /></MemoryRouter>);
    expect(screen.getAllByTestId('notification-center')).toHaveLength(1);
    const desktopNav = screen.getByRole('navigation', { name: 'Student navigation' });
    expect(within(desktopNav).getAllByRole('link')).toHaveLength(4);
    expect(within(desktopNav).getByRole('link', { name: 'Check My Topic' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('student-account')).toHaveTextContent('Workspace User · Student');
  });

  it.each([
    ['student', '/student/my-submissions/', 'Student navigation', 'My Submissions', 4],
    ['lecturer', '/lecturer/pending-reviews/', 'Lecturer navigation', 'Pending Reviews', 6],
    ['admin', '/admin/topic-repository/', 'Administrator navigation', 'Topic Repository', 6]
  ])('renders the complete %s navigation and trailing-slash active route', (role, path, label, activeName, count) => {
    renderNav(role, path);
    const nav = screen.getByRole('navigation', { name: label });
    expect(within(nav).getAllByRole('link')).toHaveLength(count);
    expect(within(nav).getByRole('link', { name: activeName })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByTestId('notification-center')).toHaveLength(1);
    expect(roleNavigation[role]).toHaveLength(count);
  });

  // Pilot treatment: the Research Explorer page is still a placeholder, so it is
  // deliberately not advertised anywhere in ordinary navigation. The route stays
  // reachable and truthful; only the nav entry is withheld.
  it.each([
    ['student', '/student/dashboard', 'Student navigation'],
    ['student', '/student/my-submissions', 'Student navigation']
  ])('does not advertise the deferred Research Explorer in %s navigation', (role, path, label) => {
    renderNav(role, path);
    const nav = screen.getByRole('navigation', { name: label });
    expect(within(nav).queryByRole('link', { name: /research explorer/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /research explorer/i })).toBeNull();
  });

  it('keeps the deferred entry declared but out of the student navigation', () => {
    expect(deferredStudentNavigation).toEqual([
      { label: 'Research Explorer', path: '/student/research-explorer' }
    ]);
    expect(roleNavigation.student.map((item) => item.path)).not.toContain('/student/research-explorer');
    expect(studentCheckerNavigationGroups.flatMap((group) => group.items).map((item) => item.path))
      .not.toContain('/student/research-explorer');
  });

  it.each([
    ['lecturer', 'Lecturer'],
    ['admin', 'Administrator']
  ])('uses a separate desktop navigation row for %s', (role, label) => {
    renderNav(role, `/${role}/dashboard`);
    const nav = screen.getByRole('navigation', { name: `${label} navigation` });
    expect(nav.className).toContain('border-t');
    expect(nav.className).toContain('min-[1151px]:block');
  });

  it('opens a vertical mobile menu, changes Menu to Close, and restores focus on Escape', async () => {
    const user = userEvent.setup();
    renderNav('student', '/student/dashboard');
    const menu = screen.getByRole('button', { name: 'Menu' });
    await user.click(menu);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Student mobile navigation' })).toHaveClass('block');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });

  it('logs out through the real account action', async () => {
    const user = userEvent.setup();
    logout.mockResolvedValue();
    renderNav('admin', '/admin/dashboard');
    await user.click(screen.getByTestId('admin-logout'));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
  });
});
