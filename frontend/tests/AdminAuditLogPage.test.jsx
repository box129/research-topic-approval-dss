import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminAuditLogPage from '../src/pages/admin/AuditLogPage';
import apiClient from '../src/api/client';
import axios from 'axios';
import {
  getAdminAuditLogDetail,
  listAdminAuditLogs,
  previewAdminAuditLogPurge,
  purgeAdminAuditLogs
} from '../src/api/admin';

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
  getAdminAuditLogDetail: vi.fn(),
  listAdminAuditLogs: vi.fn(),
  previewAdminAuditLogPurge: vi.fn(),
  purgeAdminAuditLogs: vi.fn()
}));

vi.mock('../src/auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'admin@example.edu',
      name: 'Admin User',
      role: 'admin'
    }
  })
}));

const auditLog = {
  id: 42,
  event_type: 'USER_STATUS_CHANGED',
  actor: {
    id: 1,
    role: 'admin',
    email: 'admin@example.edu'
  },
  target: {
    type: 'User',
    id: '7'
  },
  request: {
    id: 'req-123',
    ip_address: '127.0.0.1',
    user_agent: 'Vitest'
  },
  metadata: {
    status: 'suspended',
    auditEventType: 'USER_STATUS_CHANGED'
  },
  created_at: '2026-06-06T10:00:00.000Z'
};

const listResponse = {
  data: {
    items: [auditLog]
  },
  meta: {
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    filters: {}
  }
};

describe('AdminAuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    listAdminAuditLogs.mockResolvedValue(listResponse);
    getAdminAuditLogDetail.mockResolvedValue({
      data: {
        audit_log: auditLog
      }
    });
    previewAdminAuditLogPurge.mockResolvedValue({
      data: {
        purgePreview: {
          cutoffDate: '2025-06-22T12:00:00.000Z',
          olderThanDays: 365,
          candidateCount: 4,
          willDeleteCount: 4,
          maxBatch: 1000,
          policy: {
            retentionDays: 365,
            purgeMinAgeDays: 90,
            confirmationPhrase: 'CONFIRM_AUDIT_PURGE'
          },
          summary: {
            byEventType: [
              { eventType: 'USER_STATUS_CHANGED', count: 4 }
            ],
            byActorRole: [
              { actorRole: 'admin', count: 4 }
            ]
          }
        }
      }
    });
    purgeAdminAuditLogs.mockResolvedValue({
      data: {
        purge: {
          cutoffDate: '2025-06-22T12:00:00.000Z',
          olderThanDays: 365,
          candidateCount: 4,
          deletedCount: 4,
          maxBatch: 1000,
          auditEventType: 'AUDIT_LOGS_PURGED'
        }
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders stored audit log rows from the read-only audit API', async () => {
    render(<AdminAuditLogPage />);

    expect(screen.getByRole('heading', { name: /audit log/i })).toBeInTheDocument();
    expect(screen.getByText(/Review stored governance events and manage guarded retention controls/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(listAdminAuditLogs).toHaveBeenCalledWith({
        page: 1,
        limit: 10
      });
    });

    expect(screen.getAllByText(/USER_STATUS_CHANGED/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/admin@example.edu/i)).toBeInTheDocument();
    expect(screen.getByText(/Request req-123/i)).toBeInTheDocument();
    expect(screen.getByText(/Audit purge governance/i)).toBeInTheDocument();
    expect(screen.getByText(/Audit history can be exported from Reports/i)).toBeInTheDocument();
    expect(screen.queryByText(/fake login/i)).not.toBeInTheDocument();
  });

  it('passes search, actor role, and event filters to the audit list helper', async () => {
    render(<AdminAuditLogPage />);

    await waitFor(() => {
      expect(listAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByPlaceholderText(/search event, actor, target/i), {
      target: { name: 'search', value: 'status' }
    });
    fireEvent.change(screen.getByDisplayValue(/All actor roles/i), {
      target: { name: 'actorRole', value: 'admin' }
    });
    fireEvent.change(screen.getByPlaceholderText(/event type/i), {
      target: { name: 'eventType', value: 'USER_STATUS_CHANGED' }
    });

    await waitFor(() => {
      expect(listAdminAuditLogs).toHaveBeenLastCalledWith({
        actorRole: 'admin',
        eventType: 'USER_STATUS_CHANGED',
        limit: 10,
        page: 1,
        search: 'status'
      });
    });
  });

  it('loads safe audit detail from the detail endpoint only', async () => {
    render(<AdminAuditLogPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view detail/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /view detail/i }));

    await waitFor(() => {
      expect(getAdminAuditLogDetail).toHaveBeenCalledWith(42);
      expect(screen.getAllByText(/Selected audit event/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/"status": "suspended"/i)).toBeInTheDocument();
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(apiClient.delete).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.patch).not.toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it('previews audit purge candidates using the backend result only', async () => {
    render(<AdminAuditLogPage />);

    await waitFor(() => {
      expect(listAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText(/Purge logs older than days/i), {
      target: { value: '400' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Preview purge/i }));

    await waitFor(() => {
      expect(previewAdminAuditLogPurge).toHaveBeenCalledWith({ olderThanDays: 400 });
    });

    expect(screen.getByText(/Candidate logs: 4/i)).toBeInTheDocument();
    expect(screen.getByText(/Will delete: 4/i)).toBeInTheDocument();
    expect(screen.getByText(/A completed purge cannot be reversed/i)).toBeInTheDocument();
    expect(screen.queryByText(/private metadata/i)).not.toBeInTheDocument();
    expect(purgeAdminAuditLogs).not.toHaveBeenCalled();
  });

  it('requires exact confirmation before purging old audit logs', async () => {
    render(<AdminAuditLogPage />);

    await waitFor(() => {
      expect(listAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /Preview purge/i }));

    await waitFor(() => {
      expect(screen.getByText(/Candidate logs: 4/i)).toBeInTheDocument();
    });

    const purgeButton = screen.getByRole('button', { name: /Purge old audit logs/i });
    expect(purgeButton).toBeDisabled();
    expect(purgeButton).toHaveClass('bg-red-700');

    fireEvent.change(screen.getByPlaceholderText(/CONFIRM_AUDIT_PURGE/i), {
      target: { value: 'CONFIRM_AUDIT_PURGE' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Purge old audit logs/i }));

    await waitFor(() => {
      expect(purgeAdminAuditLogs).toHaveBeenCalledWith({
        olderThanDays: 365,
        confirmation: 'CONFIRM_AUDIT_PURGE'
      });
    });
    expect(screen.getByText(/4 old audit logs purged/i)).toBeInTheDocument();
    expect(screen.getByText(/AUDIT_LOGS_PURGED/i)).toBeInTheDocument();
  });

  it('shows purge preview errors without fake candidate counts', async () => {
    previewAdminAuditLogPurge.mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Audit purge cutoff must be at least 90 days old.'
          }
        }
      }
    });

    render(<AdminAuditLogPage />);

    await waitFor(() => {
      expect(listAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /Preview purge/i }));

    await waitFor(() => {
      expect(screen.getByText(/Audit purge cutoff must be at least 90 days old/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Candidate logs:/i)).not.toBeInTheDocument();
  });

  const emptyAuditResponse = {
    data: { items: [] },
    meta: {
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      }
    }
  };

  it('renders the genuine-empty state when no audit events exist and no filter is active', async () => {
    // Truthful for a fresh system and for a repository after a retention purge.
    listAdminAuditLogs.mockResolvedValue(emptyAuditResponse);

    render(<AdminAuditLogPage />);

    await waitFor(() => {
      expect(screen.getByText('No audit events yet')).toBeInTheDocument();
    });
    expect(screen.getByText('No audit events are currently available.')).toBeInTheDocument();
    // A genuinely empty log must never be blamed on filters.
    expect(screen.queryByText(/match the selected filters/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/match these filters/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it('renders the filtered-empty state and restores the unfiltered log via Clear Filters', async () => {
    listAdminAuditLogs.mockImplementation((params = {}) => Promise.resolve(
      params.search ? emptyAuditResponse : listResponse
    ));

    render(<AdminAuditLogPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/USER_STATUS_CHANGED/i).length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.change(screen.getByPlaceholderText(/search event, actor, target/i), {
      target: { name: 'search', value: 'no-match-term' }
    });

    expect(await screen.findByText('No audit events match these filters')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting or clearing the current filters.')).toBeInTheDocument();
    // The filter context stays visible while the filtered result is empty.
    expect(screen.getByPlaceholderText(/search event, actor, target/i)).toHaveValue('no-match-term');
    expect(screen.queryByText('No audit events yet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

    await waitFor(() => {
      expect(screen.getAllByText(/USER_STATUS_CHANGED/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByPlaceholderText(/search event, actor, target/i)).toHaveValue('');
    await waitFor(() => {
      expect(listAdminAuditLogs).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10
      });
    });
  });

  it('does not expose uncontrolled audit export or deletion controls', async () => {
    render(<AdminAuditLogPage />);

    await waitFor(() => {
      expect(listAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purge all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export audit metadata/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /csv/i })).not.toBeInTheDocument();
  });
});
