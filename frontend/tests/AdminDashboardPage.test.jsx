import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdminDashboardPage from '../src/pages/admin/DashboardPage';
import apiClient from '../src/api/client';
import axios from 'axios';
import { getAdminDashboardSummary } from '../src/api/admin';

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

vi.mock('../src/api/admin', () => ({
  getAdminDashboardSummary: vi.fn()
}));

const summaryResponse = {
  data: {
    users: {
      total: 6,
      students: 3,
      lecturers: 2,
      admins: 1,
      active: 5,
      suspended: 1,
      status: 'available'
    },
    submissions: {
      total: 8,
      pendingReview: 4,
      awaitingRevision: 1,
      approved: 2,
      rejected: 1,
      status: 'available'
    },
    topics: {
      total: 45,
      historical: 30,
      currentSession: 10,
      underReview: 5,
      status: 'available'
    },
    similarityChecks: {
      snapshots: 7,
      highRisk: 1,
      mediumRisk: 2,
      lowRisk: 4,
      status: 'available',
      notes: ['Risk distribution includes stored lecturer similarity snapshots only.']
    },
    serviceHealth: {
      api: {
        status: 'available',
        message: 'API process responded to the admin dashboard summary request.'
      },
      database: {
        status: 'available',
        message: 'Database counts were read from existing tables.'
      },
      semanticProvider: {
        status: 'unknown',
        provider: 'voyage',
        model: 'voyage-4-large',
        message: 'Voyage semantic provider (voyage-4-large) health is not checked by this dashboard endpoint yet.'
      }
    },
    warnings: []
  },
  meta: {
    generatedAt: '2026-06-05T15:37:00.000Z',
    dataCoverage: 'Read-only counts from existing tables.'
  }
};

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    getAdminDashboardSummary.mockResolvedValue(summaryResponse);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the Admin Dashboard header and read-only overview shell', async () => {
    render(<AdminDashboardPage />);

    expect(screen.getByRole('heading', { name: /admin dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/monitor service status and key administrative metrics/i)).toBeInTheDocument();

    await waitFor(() => expect(getAdminDashboardSummary).toHaveBeenCalledTimes(1));
  });

  it('calls the dashboard summary API and renders returned real counts', async () => {
    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(getAdminDashboardSummary).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/^6$/)).toBeInTheDocument();
    expect(screen.getByText(/3 students, 2 lecturers, 1 admin/i)).toBeInTheDocument();
    expect(screen.getByText(/^45$/)).toBeInTheDocument();
    expect(screen.getByText(/30 historical, 10 current-session, 5 under-review topics/i)).toBeInTheDocument();
    expect(screen.getByText(/^4$/)).toBeInTheDocument();
    expect(screen.getByText(/8 total submissions/i)).toBeInTheDocument();
    // The awaitingRevision summary field renders as canonical vocabulary in
    // the helper prose; the retired phrasing never renders.
    expect(screen.getByText(/revision requested/i)).toBeInTheDocument();
    expect(screen.queryByText(/awaiting revision/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^7$/)).toBeInTheDocument();
    // Slice 3: the helper renders neutral similarity language from the
    // unchanged highRisk/mediumRisk/lowRisk summary fields.
    expect(screen.getByText(/1 higher similarity, 2 moderate similarity, 4 lower similarity stored snapshots/i)).toBeInTheDocument();
    expect(screen.queryByText(/high-risk|medium-risk|low-risk/i)).not.toBeInTheDocument();
  });

  it('shows API, database, and Voyage semantic-provider health without inventing a provider status', async () => {
    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/^API$/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/^Database$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Voyage semantic provider$/i)).toBeInTheDocument();
    expect(screen.getByText(/Voyage semantic provider \(voyage-4-large\) health is not checked by this dashboard endpoint yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Healthy$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Online$/i)).not.toBeInTheDocument();
  });

  it('renders partial coverage warnings when the API marks a section unavailable', async () => {
    getAdminDashboardSummary.mockResolvedValue({
      ...summaryResponse,
      data: {
        ...summaryResponse.data,
        users: {
          total: null,
          students: null,
          lecturers: null,
          admins: null,
          active: null,
          suspended: null,
          status: 'unavailable'
        },
        serviceHealth: {
          ...summaryResponse.data.serviceHealth,
          database: {
            status: 'unavailable',
            message: 'One or more database-backed dashboard sections could not be read.'
          }
        },
        warnings: [
          {
            section: 'users',
            code: 'ADMIN_DASHBOARD_USERS_UNAVAILABLE',
            message: 'users counts are unavailable from the database.'
          }
        ]
      }
    });

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/partial dashboard coverage/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/users counts are unavailable from the database/i)).toBeInTheDocument();
    expect(screen.getByText(/User counts are unavailable from the read-only dashboard summary/i)).toBeInTheDocument();
  });

  it('shows an honest unavailable state when the read-only endpoint fails', async () => {
    getAdminDashboardSummary.mockRejectedValue(new Error('network unavailable'));

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/summary unavailable/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(/Administrative metrics could not be loaded/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Unavailable/i).length).toBeGreaterThanOrEqual(4);
  });

  it('does not call fetch, axios mutations, apiClient mutations, or unsupported admin endpoints', async () => {
    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(getAdminDashboardSummary).toHaveBeenCalledTimes(1);
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.patch).not.toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it('does not expose fake dashboard activity, reports, exports, or workflow links', async () => {
    render(<AdminDashboardPage />);

    await waitFor(() => expect(getAdminDashboardSummary).toHaveBeenCalledTimes(1));

    expect(screen.queryByText(/critical high-risk submission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/generated monthly report/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/user account created/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approved two topics/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/workload trend/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/average similarity/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
