import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from '../src/pages/auth/LoginPage';
import { useAuth } from '../src/auth/AuthContext';

vi.mock('../src/auth/AuthContext', () => ({
  useAuth: vi.fn()
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderLoginPage({ initialEntry = '/login', login = vi.fn() } = {}) {
  useAuth.mockReturnValue({ login });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders AUTH-01 split login content and forgot-password link', () => {
    renderLoginPage();

    expect(screen.getByRole('heading', { name: /research topic similarity detection system/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/university email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/secure password/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByText(/^No role selector$/i)).toBeInTheDocument();
  });

  it('submits email and password to login', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({ role: 'lecturer' });
    renderLoginPage({ login });

    await user.type(screen.getByLabelText(/email/i), 'lecturer@example.edu');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'lecturer@example.edu',
        password: 'password123'
      });
    });
  });

  it('redirects to role dashboard when no safe requested path exists', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({ role: 'student' });
    renderLoginPage({ login });

    await user.type(screen.getByLabelText(/email/i), 'student@example.edu');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByTestId('location-display')).toHaveTextContent('/student/dashboard');
  });

  it('redirects to safe requested path when it matches returned role', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({ role: 'student' });
    renderLoginPage({
      initialEntry: {
        pathname: '/login',
        state: { from: '/student/my-submissions' }
      },
      login
    });

    await user.type(screen.getByLabelText(/email/i), 'student@example.edu');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByTestId('location-display')).toHaveTextContent('/student/my-submissions');
  });

  it('shows server error text on rejected login', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } }
    });
    renderLoginPage({ login });

    await user.type(screen.getByLabelText(/email/i), 'student@example.edu');
    await user.type(screen.getByLabelText(/password/i), 'bad-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it('shows signing-in disabled state while login is pending', async () => {
    const user = userEvent.setup();
    const login = vi.fn(() => new Promise(() => {}));
    renderLoginPage({ login });

    await user.type(screen.getByLabelText(/email/i), 'student@example.edu');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/password/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
  });
});
