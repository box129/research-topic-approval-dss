import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '../src/auth/useAuth';
import LoginPage from '../src/pages/auth/LoginPage';
import ForgotPasswordPage from '../src/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../src/pages/auth/ResetPasswordPage';
import AcceptInvitationPage from '../src/pages/auth/AcceptInvitationPage';

vi.mock('../src/auth/useAuth', () => ({ useAuth: vi.fn() }));

// Students at the target institution are not issued institution-assigned
// mailboxes, so no authentication surface may imply that a university-issued
// address is expected or required.
const UNIVERSITY_EMAIL_WORDING = /university (e-?mail|account)|institutional e-?mail|school e-?mail|official e-?mail|uniosun\.edu/i;

function renderAt(path, element) {
  useAuth.mockReturnValue({
    login: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    acceptInvitation: vi.fn(),
    validateInvitation: vi.fn().mockResolvedValue({ account: { email: 'someone@example.com' } })
  });

  return render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
}

describe('email neutrality contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('the sign-in page asks for an email address without implying a university account', () => {
    renderAt('/login', <LoginPage />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(UNIVERSITY_EMAIL_WORDING);
  });

  it('password recovery asks for an email address without implying a university account', () => {
    renderAt('/forgot-password', <ForgotPasswordPage />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(UNIVERSITY_EMAIL_WORDING);
  });

  it('password reset does not imply a university account', () => {
    renderAt('/reset-password?token=reset-token', <ResetPasswordPage />);

    expect(document.body.textContent).not.toMatch(UNIVERSITY_EMAIL_WORDING);
  });

  it('invitation acceptance does not imply a university account', () => {
    renderAt('/accept-invitation?token=invite-token', <AcceptInvitationPage />);

    expect(document.body.textContent).not.toMatch(UNIVERSITY_EMAIL_WORDING);
  });

  it('no authentication surface presents a university email domain as an example', () => {
    for (const [path, element] of [
      ['/login', <LoginPage key="login" />],
      ['/forgot-password', <ForgotPasswordPage key="forgot" />]
    ]) {
      const { unmount } = renderAt(path, element);
      const inputs = document.querySelectorAll('input[type="email"]');
      inputs.forEach((input) => {
        expect(input.getAttribute('placeholder') || '').not.toMatch(/uniosun|\.edu(\.|$)/i);
      });
      unmount();
    }
  });
});
