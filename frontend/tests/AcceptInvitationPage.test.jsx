import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AcceptInvitationPage from '../src/pages/auth/AcceptInvitationPage';

const validateInvitation = vi.fn();
const acceptInvitation = vi.fn();

vi.mock('../src/auth/useAuth', () => ({
  useAuth: () => ({
    acceptInvitation,
    validateInvitation
  })
}));

const TOKEN = 'A'.repeat(43);

function renderAtInvitationUrl(search = `?token=${TOKEN}`) {
  // Mirror the real emailed-link situation: the token is present in both the
  // router location and the browser address bar.
  window.history.replaceState(null, '', `/accept-invitation${search}`);
  return render(
    <MemoryRouter initialEntries={[`/accept-invitation${search}`]}>
      <AcceptInvitationPage />
    </MemoryRouter>
  );
}

describe('AcceptInvitationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateInvitation.mockResolvedValue({
      data: {
        account: { name: 'Synthetic Student', email: 'synthetic.student@example.edu', role: 'student' },
        expiresAt: '2026-08-30T10:00:00.000Z'
      }
    });
    acceptInvitation.mockResolvedValue({
      data: { user: { id: 5, role: 'student', mustChangePassword: false } }
    });
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('captures the token, scrubs it from the URL, and validates it', async () => {
    renderAtInvitationUrl();

    await waitFor(() => {
      expect(validateInvitation).toHaveBeenCalledWith({ token: TOKEN });
    });

    // The one-time token is removed from the address bar and history.
    expect(window.location.search).toBe('');
    expect(window.location.href).not.toContain(TOKEN);

    expect(await screen.findByText(/Setting the password for Synthetic Student/i)).toBeInTheDocument();
    // The token is never persisted to browser storage.
    expect(JSON.stringify(window.localStorage)).not.toContain(TOKEN);
    expect(JSON.stringify(window.sessionStorage)).not.toContain(TOKEN);
  });

  it('submits the chosen password with the captured token', async () => {
    renderAtInvitationUrl();
    await screen.findByText(/Setting the password for Synthetic Student/i);

    fireEvent.change(screen.getByLabelText(/^Choose a password/i), {
      target: { value: 'MyPrivatePass1' }
    });
    fireEvent.change(screen.getByLabelText(/^Confirm password/i), {
      target: { value: 'MyPrivatePass1' }
    });
    fireEvent.click(screen.getByRole('button', { name: /set password and sign in/i }));

    await waitFor(() => {
      expect(acceptInvitation).toHaveBeenCalledWith({ token: TOKEN, password: 'MyPrivatePass1' });
    });
  });

  it('blocks submission when passwords do not match', async () => {
    renderAtInvitationUrl();
    await screen.findByText(/Setting the password for Synthetic Student/i);

    fireEvent.change(screen.getByLabelText(/^Choose a password/i), {
      target: { value: 'MyPrivatePass1' }
    });
    fireEvent.change(screen.getByLabelText(/^Confirm password/i), {
      target: { value: 'Different1' }
    });
    fireEvent.click(screen.getByRole('button', { name: /set password and sign in/i }));

    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument();
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it('shows a neutral message for invalid or expired links and disables the form', async () => {
    validateInvitation.mockRejectedValue({
      response: { data: { message: 'This invitation link is invalid or has expired. Ask an administrator to send a new invitation.' } }
    });
    renderAtInvitationUrl();

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set password and sign in/i })).toBeDisabled();
  });

  it('explains an incomplete link without calling the API', async () => {
    renderAtInvitationUrl('');

    expect(await screen.findByText(/activation link is incomplete/i)).toBeInTheDocument();
    expect(validateInvitation).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /set password and sign in/i })).toBeDisabled();
  });
});
