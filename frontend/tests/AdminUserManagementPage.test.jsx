import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminUserManagementPage from '../src/pages/admin/UserManagementPage';
import apiClient from '../src/api/client';
import axios from 'axios';
import { listAdminUsers, updateAdminUserStatus } from '../src/api/admin';

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
  listAdminUsers: vi.fn(),
  updateAdminUserStatus: vi.fn()
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

const listResponse = {
  data: {
    items: [
      {
        id: 1,
        name: 'Admin User',
        email: 'admin@example.edu',
        role: 'admin',
        status: 'active',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-05T10:00:00.000Z'
      },
      {
        id: 2,
        name: 'Student One',
        email: 'student.one@example.edu',
        role: 'student',
        status: 'active',
        createdAt: '2026-06-02T10:00:00.000Z',
        updatedAt: '2026-06-05T11:00:00.000Z'
      },
      {
        id: 3,
        name: 'Lecturer One',
        email: 'lecturer.one@example.edu',
        role: 'lecturer',
        status: 'suspended',
        createdAt: '2026-06-03T10:00:00.000Z',
        updatedAt: '2026-06-05T12:00:00.000Z'
      }
    ]
  },
  meta: {
    pagination: {
      page: 1,
      limit: 10,
      total: 3,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    filters: {
      role: 'all',
      status: 'all',
      sort: 'updatedAt',
      direction: 'desc'
    },
    dataCoverage: 'Read-only users from existing User records.'
  }
};

describe('AdminUserManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    listAdminUsers.mockResolvedValue(listResponse);
    updateAdminUserStatus.mockResolvedValue({
      data: {
        user: {
          ...listResponse.data.items[1],
          status: 'suspended'
        }
      },
      meta: {
        auditEventType: 'USER_STATUS_CHANGED'
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders connected real user rows without sensitive fields', async () => {
    render(<AdminUserManagementPage />);

    expect(screen.getByRole('heading', { name: /user management/i })).toBeInTheDocument();
    expect(screen.getByText(/read-only user directory connected to existing account records/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(listAdminUsers).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { level: 2, name: 'Admin User' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Student One' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Lecturer One' })).toBeInTheDocument();
    expect(screen.queryByText(/passwordHash/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/resetTokenHash/i)).not.toBeInTheDocument();
  });

  it('calls the users endpoint with role, status, and search filters', async () => {
    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(listAdminUsers).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByPlaceholderText(/search name or email/i), {
      target: { name: 'search', value: 'student' }
    });
    fireEvent.change(screen.getByDisplayValue(/All roles/i), {
      target: { name: 'role', value: 'student' }
    });
    fireEvent.change(screen.getByDisplayValue(/All statuses/i), {
      target: { name: 'status', value: 'active' }
    });

    await waitFor(() => {
      expect(listAdminUsers).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10,
        sort: 'updatedAt',
        direction: 'desc',
        role: 'student',
        status: 'active',
        search: 'student'
      });
    });
  });

  it('performs only the audited status update action after confirmation', async () => {
    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/Student One/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /suspend account/i }));

    await waitFor(() => {
      expect(updateAdminUserStatus).toHaveBeenCalledWith(2, 'suspended');
      expect(screen.getByText(/Audit event USER_STATUS_CHANGED was requested/i)).toBeInTheDocument();
    });

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('student.one@example.edu'));
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.delete).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it('does not call the status update helper when confirmation is cancelled', async () => {
    window.confirm.mockReturnValue(false);
    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/Student One/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /suspend account/i }));

    expect(updateAdminUserStatus).not.toHaveBeenCalled();
  });

  it('shows an honest empty state when the user list is empty', async () => {
    listAdminUsers.mockResolvedValue({
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

    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/No user records returned/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No placeholder accounts are shown/i)).toBeInTheDocument();
  });

  it('shows unavailable states when the users endpoint fails', async () => {
    listAdminUsers.mockRejectedValue(new Error('users unavailable'));

    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/User records unavailable/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No fallback user rows are displayed/i)).toBeInTheDocument();
  });

  it('does not expose unsupported account actions', async () => {
    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(listAdminUsers).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('button', { name: /add user/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset password/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change role/i })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
