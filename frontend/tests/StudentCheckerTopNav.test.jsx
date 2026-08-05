import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StudentCheckerTopNav from '../src/layouts/StudentCheckerTopNav';

vi.mock('../src/auth/useAuth', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { name: 'Student Test' } })
}));

vi.mock('../src/layouts/NotificationCenter', () => ({
  default: () => <div data-testid="notification-center">Notifications</div>
}));

describe('StudentCheckerTopNav', () => {
  it('mounts one NotificationCenter and uses the shared five-link navigation', () => {
    render(<MemoryRouter><StudentCheckerTopNav /></MemoryRouter>);

    expect(screen.getAllByTestId('notification-center')).toHaveLength(1);
    expect(screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('/student/'))).toHaveLength(6);
    expect(screen.getByText('Student')).toBeInTheDocument();
  });
});
