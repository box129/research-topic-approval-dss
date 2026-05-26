import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminDashboardPage from '../src/pages/admin/DashboardPage';
import apiClient from '../src/api/client';
import axios from 'axios';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}));

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the Admin Dashboard header and overview shell', () => {
    render(<AdminDashboardPage />);

    expect(screen.getByRole('heading', { name: /admin dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/system oversight shell/i)).toBeInTheDocument();
    expect(screen.getByText(/admin metrics are not connected yet/i)).toBeInTheDocument();
    expect(screen.getByText(/presentation-only/i)).toBeInTheDocument();
  });

  it('shows honest unavailable and not-connected placeholders', () => {
    render(<AdminDashboardPage />);

    expect(screen.getAllByText(/not connected yet/i).length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText(/not available yet/i).length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/safe admin dashboard API exists/i)).toBeInTheDocument();
    expect(screen.getByText(/recent activity is not connected yet/i)).toBeInTheDocument();
  });

  it('shows API, database, and SBERT health areas without claiming fake live status', () => {
    render(<AdminDashboardPage />);

    expect(screen.getByText(/^API$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Database$/i)).toBeInTheDocument();
    expect(screen.getByText(/^SBERT$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Ready$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Healthy$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Online$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/not live system status/i)).toBeInTheDocument();
  });

  it('does not call fetch, axios, apiClient, or admin endpoints', () => {
    render(<AdminDashboardPage />);

    expect(fetch).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();

    const calledPaths = [
      ...axios.get.mock.calls,
      ...axios.post.mock.calls,
      ...apiClient.get.mock.calls,
      ...apiClient.post.mock.calls
    ].map(([path]) => path);

    expect(calledPaths.some((path) => String(path).includes('/admin'))).toBe(false);
  });

  it('does not expose fake counts or fake dashboard data', () => {
    render(<AdminDashboardPage />);

    expect(screen.queryByText(/^128$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^42$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^7$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/critical high-risk submission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/generated monthly report/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/user account created/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approved two topics/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/workload trend/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/average similarity/i)).not.toBeInTheDocument();
  });

  it('keeps admin workflows deferred instead of adding navigation actions', () => {
    render(<AdminDashboardPage />);

    expect(screen.getByText(/user management, reports, audit logs, settings, data import/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
