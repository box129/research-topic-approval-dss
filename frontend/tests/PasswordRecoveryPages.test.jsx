import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '../src/auth/useAuth';
import ForgotPasswordPage from '../src/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../src/pages/auth/ResetPasswordPage';

vi.mock('../src/auth/useAuth', () => ({
  useAuth: vi.fn()
}));

function renderForgotPasswordPage({ forgotPassword = vi.fn() } = {}) {
  useAuth.mockReturnValue({ forgotPassword });

  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <ForgotPasswordPage />
    </MemoryRouter>
  );
}

function renderResetPasswordPage({
  initialEntry = '/reset-password?token=reset-token',
  resetPassword = vi.fn()
} = {}) {
  useAuth.mockReturnValue({ resetPassword });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ResetPasswordPage />
    </MemoryRouter>
  );
}

describe('password recovery pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the forgot-password email through the existing auth handler', async () => {
    const user = userEvent.setup();
    const forgotPassword = vi.fn().mockResolvedValue({
      message: 'If that email exists, a password reset link has been sent.'
    });
    renderForgotPasswordPage({ forgotPassword });

    expect(screen.getByRole('heading', { name: /forgot your password/i })).toBeInTheDocument();
    expect(screen.getByText(/response does not confirm whether an account exists/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/university email address/i), 'student@example.edu');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(forgotPassword).toHaveBeenCalledWith({ email: 'student@example.edu' });
    });
    expect(await screen.findByText(/if that email exists/i)).toBeInTheDocument();
  });

  it('keeps reset-password inputs disabled when the token is missing', () => {
    renderResetPasswordPage({ initialEntry: '/reset-password' });

    expect(screen.getByText(/reset token is missing/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password/i)).toBeDisabled();
    expect(screen.getByLabelText(/confirm new password/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /set new password/i })).toBeDisabled();
  });

  it('submits the token and password through the existing reset handler', async () => {
    const user = userEvent.setup();
    const resetPassword = vi.fn().mockResolvedValue({ message: 'Password has been reset.' });
    renderResetPasswordPage({ resetPassword });

    await user.type(screen.getByLabelText(/^new password/i), 'secure123');
    await user.type(screen.getByLabelText(/confirm new password/i), 'secure123');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({
        token: 'reset-token',
        password: 'secure123'
      });
    });
    expect(await screen.findByText(/password has been reset/i)).toBeInTheDocument();
  });

  it('keeps mismatched passwords client-side and does not submit', async () => {
    const user = userEvent.setup();
    const resetPassword = vi.fn();
    renderResetPasswordPage({ resetPassword });

    await user.type(screen.getByLabelText(/^new password/i), 'secure123');
    await user.type(screen.getByLabelText(/confirm new password/i), 'different123');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });
});
