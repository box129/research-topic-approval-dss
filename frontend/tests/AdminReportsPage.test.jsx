import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdminReportsPage from '../src/pages/admin/ReportsPage';
import apiClient from '../src/api/client';
import axios from 'axios';
import { getAdminReportsSummary } from '../src/api/admin';

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
  getAdminReportsSummary: vi.fn()
}));

vi.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'admin@example.edu',
      name: 'Admin User',
      role: 'admin'
    }
  })
}));

const reportsResponse = {
  data: {
    users: {
      total: 6,
      byRole: {
        students: 3,
        lecturers: 2,
        admins: 1
      },
      byStatus: {
        active: 5,
        suspended: 1
      }
    },
    submissions: {
      total: 8,
      byStatus: {
        pendingReview: 2,
        awaitingRevision: 1,
        approved: 4,
        rejected: 1
      },
      decisionCoverage: {
        decided: 6,
        pending: 2
      }
    },
    topics: {
      total: 45,
      byLifecycle: {
        historical: 30,
        currentSession: 10,
        underReview: 5
      }
    },
    similarityChecks: {
      snapshots: 7,
      byRisk: {
        high: 1,
        medium: 2,
        low: 3,
        unknown: 1
      },
      byResponseStatus: {
        success: 5,
        partialSuccess: 1,
        error: 1,
        other: 0
      },
      notes: ['Similarity report counts use stored lecturer snapshots only.']
    },
    auditLogs: {
      total: 4,
      byActorRole: {
        admin: 3,
        lecturer: 1,
        student: 0,
        unknown: 0
      },
      topEventTypes: [
        {
          eventType: 'USER_STATUS_CHANGED',
          count: 2
        }
      ]
    },
    exports: {
      status: 'deferred',
      message: 'Report export generation is not implemented. No PDF, CSV, or download endpoint is exposed.'
    },
    warnings: []
  },
  meta: {
    generatedAt: '2026-06-06T10:05:14.000Z',
    dataCoverage: 'Read-only report aggregates from existing tables.',
    sourceTables: ['User', 'Submission', 'AuditLog'],
    exportStatus: 'deferred'
  }
};

function zeroReportsResponse() {
  return {
    data: {
      users: {
        total: 0,
        byRole: { students: 0, lecturers: 0, admins: 0 },
        byStatus: { active: 0, suspended: 0 }
      },
      submissions: {
        total: 0,
        byStatus: { pendingReview: 0, awaitingRevision: 0, approved: 0, rejected: 0 },
        decisionCoverage: { decided: 0, pending: 0 }
      },
      topics: {
        total: 0,
        byLifecycle: { historical: 0, currentSession: 0, underReview: 0 }
      },
      similarityChecks: {
        snapshots: 0,
        byRisk: { high: 0, medium: 0, low: 0, unknown: 0 },
        byResponseStatus: { success: 0, partialSuccess: 0, error: 0, other: 0 },
        notes: []
      },
      auditLogs: {
        total: 0,
        byActorRole: { admin: 0, lecturer: 0, student: 0, unknown: 0 },
        topEventTypes: []
      },
      exports: {
        status: 'deferred',
        message: 'Report export generation is not implemented. No PDF, CSV, or download endpoint is exposed.'
      },
      warnings: []
    },
    meta: reportsResponse.meta
  };
}

describe('AdminReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    getAdminReportsSummary.mockResolvedValue(reportsResponse);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders real aggregate values from the reports summary endpoint', async () => {
    render(<AdminReportsPage />);

    expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument();
    expect(screen.getByText(/read-only reporting summary connected to existing aggregate data/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(getAdminReportsSummary).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/User coverage/i)).toBeInTheDocument();
    expect(screen.getByText(/Students: 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Approved: 4/i)).toBeInTheDocument();
    expect(screen.getByText(/Historical: 30/i)).toBeInTheDocument();
    expect(screen.getByText(/USER_STATUS_CHANGED/i)).toBeInTheDocument();
  });

  it('keeps report export generation visibly deferred', async () => {
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(getAdminReportsSummary).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('button', { name: /CSV export deferred/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /PDF export deferred/i })).toBeDisabled();
    expect(screen.getAllByText(/No PDF, CSV, or download endpoint is exposed/i).length).toBeGreaterThanOrEqual(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(apiClient.delete).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.patch).not.toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it('shows an honest insufficient-data state for zero aggregates', async () => {
    getAdminReportsSummary.mockResolvedValue(zeroReportsResponse());

    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Not enough report data yet/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No placeholder metrics, charts, or exports are shown/i)).toBeInTheDocument();
  });

  it('shows unavailable state when the reports summary endpoint fails', async () => {
    getAdminReportsSummary.mockRejectedValue(new Error('reports unavailable'));

    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Reports summary unavailable/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No fallback report metrics are displayed/i)).toBeInTheDocument();
  });

  it('does not expose unsupported generated report actions', async () => {
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(getAdminReportsSummary).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate report/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export now/i })).not.toBeInTheDocument();
  });
});
