import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ChangePasswordPage from '../src/pages/auth/ChangePasswordPage';
import { useAuth } from '../src/auth/useAuth';

vi.mock('../src/auth/useAuth', () => ({
  useAuth: vi.fn()
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderPage({
  changePassword = vi.fn(),
  logout = vi.fn(),
  user = { id: 3, role: 'student', mustChangePassword: true }
} = {}) {
  useAuth.mockReturnValue({ changePassword, logout, user });

  return render(
    <MemoryRouter initialEntries={['/change-password']}>
      <Routes>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains the forced first-access state for temporary credentials', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /set your own password/i })).toBeInTheDocument();
    expect(screen.getByText(/temporary password only allows this step/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/temporary password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
  });

  it('shows the normal change-password framing when no forced change is pending', () => {
    renderPage({ user: { id: 3, role: 'student', mustChangePassword: false } });

    expect(screen.getByRole('heading', { name: /change your password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.queryByText(/temporary password only allows this step/i)).not.toBeInTheDocument();
  });

  it('rejects mismatched confirmation before calling the API', async () => {
    const user = userEvent.setup();
    const changePassword = vi.fn();
    renderPage({ changePassword });

    await user.type(screen.getByLabelText(/temporary password/i), 'TempPass123');
    await user.type(screen.getByLabelText(/^new password/i), 'PrivatePass9');
    await user.type(screen.getByLabelText(/confirm new password/i), 'Different9');
    await user.click(screen.getByRole('button', { name: /set password/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('submits the change and navigates to the role dashboard on success', async () => {
    const user = userEvent.setup();
    const changePassword = vi.fn().mockResolvedValue({
      data: { user: { id: 3, role: 'student', mustChangePassword: false } }
    });
    renderPage({ changePassword });

    await user.type(screen.getByLabelText(/temporary password/i), 'TempPass123');
    await user.type(screen.getByLabelText(/^new password/i), 'PrivatePass9');
    await user.type(screen.getByLabelText(/confirm new password/i), 'PrivatePass9');
    await user.click(screen.getByRole('button', { name: /set password/i }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'TempPass123',
        newPassword: 'PrivatePass9'
      });
    });
    expect(await screen.findByTestId('location-display')).toHaveTextContent('/student/dashboard');
  });

  it('surfaces backend rejections such as an incorrect current password', async () => {
    const user = userEvent.setup();
    const changePassword = vi.fn().mockRejectedValue({
      response: { data: { message: 'Current password is incorrect.' } }
    });
    renderPage({ changePassword });

    await user.type(screen.getByLabelText(/temporary password/i), 'WrongTemp123');
    await user.type(screen.getByLabelText(/^new password/i), 'PrivatePass9');
    await user.type(screen.getByLabelText(/confirm new password/i), 'PrivatePass9');
    await user.click(screen.getByRole('button', { name: /set password/i }));

    expect(await screen.findByText(/current password is incorrect/i)).toBeInTheDocument();
  });

  it('offers a sign-out escape hatch', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue();
    renderPage({ logout });

    await user.click(screen.getByRole('button', { name: /sign out instead/i }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });
    expect(await screen.findByTestId('location-display')).toHaveTextContent('/login');
  });
});
