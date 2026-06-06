import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminAuditLogPage from '../src/pages/admin/AuditLogPage';
import apiClient from '../src/api/client';
import axios from 'axios';
import { getAdminAuditLogDetail, listAdminAuditLogs } from '../src/api/admin';

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
  listAdminAuditLogs: vi.fn()
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders stored audit log rows from the read-only audit API', async () => {
    render(<AdminAuditLogPage />);

    expect(screen.getByRole('heading', { name: /audit log/i })).toBeInTheDocument();
    expect(screen.getByText(/read-only audit visibility connected to stored audit events/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(listAdminAuditLogs).toHaveBeenCalledWith({
        page: 1,
        limit: 10
      });
    });

    expect(screen.getAllByText(/USER_STATUS_CHANGED/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/admin@example.edu/i)).toBeInTheDocument();
    expect(screen.getByText(/Request req-123/i)).toBeInTheDocument();
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
      expect(screen.getByText(/Selected audit event/i)).toBeInTheDocument();
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

  it('shows an honest empty state when no audit logs are returned', async () => {
    listAdminAuditLogs.mockResolvedValue({
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
    });

    render(<AdminAuditLogPage />);

    await waitFor(() => {
      expect(screen.getByText(/No audit logs returned/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No placeholder audit events are shown/i)).toBeInTheDocument();
  });

  it('does not expose unsupported audit export or deletion controls', async () => {
    render(<AdminAuditLogPage />);

    await waitFor(() => {
      expect(listAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purge/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export audit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /csv/i })).not.toBeInTheDocument();
  });
});
