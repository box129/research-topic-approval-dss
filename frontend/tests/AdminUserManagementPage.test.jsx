import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminUserManagementPage from '../src/pages/admin/UserManagementPage';
import apiClient from '../src/api/client';
import axios from 'axios';
import {
  createAdminSuperviseeAssignment,
  createAdminUser,
  endAdminSuperviseeAssignment,
  listAdminSuperviseeAssignments,
  listAdminUsers,
  resetAdminUserCredential,
  updateAdminUserStatus
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
  createAdminSuperviseeAssignment: vi.fn(),
  createAdminUser: vi.fn(),
  endAdminSuperviseeAssignment: vi.fn(),
  listAdminSuperviseeAssignments: vi.fn(),
  listAdminUsers: vi.fn(),
  resetAdminUserCredential: vi.fn(),
  updateAdminUserStatus: vi.fn()
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

const lecturerOptionsResponse = {
  data: {
    items: [
      {
        id: 3,
        name: 'Lecturer One',
        email: 'lecturer.one@example.edu',
        role: 'lecturer',
        status: 'active',
        createdAt: '2026-06-03T10:00:00.000Z',
        updatedAt: '2026-06-05T12:00:00.000Z'
      }
    ]
  },
  meta: {}
};

const studentOptionsResponse = {
  data: {
    items: [
      {
        id: 2,
        name: 'Student One',
        email: 'student.one@example.edu',
        role: 'student',
        status: 'active',
        createdAt: '2026-06-02T10:00:00.000Z',
        updatedAt: '2026-06-05T11:00:00.000Z'
      }
    ]
  },
  meta: {}
};

const assignmentsResponse = {
  data: {
    items: [
      {
        id: 10,
        lecturer: lecturerOptionsResponse.data.items[0],
        student: studentOptionsResponse.data.items[0],
        assignedBy: listResponse.data.items[0],
        isActive: true,
        status: 'active',
        assignedAt: '2026-06-22T09:00:00.000Z',
        endedAt: null,
        notes: null
      }
    ]
  },
  meta: {}
};

function mockAdminUserLists() {
  listAdminUsers.mockImplementation((params = {}) => {
    if (params.role === 'lecturer') {
      return Promise.resolve(lecturerOptionsResponse);
    }

    if (params.role === 'student') {
      return Promise.resolve(studentOptionsResponse);
    }

    return Promise.resolve(listResponse);
  });
}

describe('AdminUserManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockAdminUserLists();
    listAdminSuperviseeAssignments.mockResolvedValue(assignmentsResponse);
    createAdminSuperviseeAssignment.mockResolvedValue({
      data: {
        item: {
          ...assignmentsResponse.data.items[0],
          id: 11
        }
      },
      meta: {
        auditEventType: 'SUPERVISEE_ASSIGNED'
      }
    });
    endAdminSuperviseeAssignment.mockResolvedValue({
      data: {
        item: {
          ...assignmentsResponse.data.items[0],
          isActive: false,
          status: 'ended',
          endedAt: '2026-06-22T10:00:00.000Z'
        }
      },
      meta: {
        auditEventType: 'SUPERVISEE_ASSIGNMENT_ENDED'
      }
    });
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
    expect(screen.getByText(/Review account records, assignments and account status/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(listAdminUsers).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        limit: 10
      }));
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
      expect(listAdminUsers).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        limit: 10
      }));
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

  it('performs the status update only after modal confirmation', async () => {
    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Student One/i).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /suspend account/i }));

    expect(updateAdminUserStatus).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: /Suspend this account/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /Suspend account/i }));

    await waitFor(() => {
      expect(updateAdminUserStatus).toHaveBeenCalledWith(2, 'suspended');
      expect(screen.getByText(/Account status updated for student.one@example.edu/i)).toBeInTheDocument();
    });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.delete).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it('does not call the status update helper when confirmation is cancelled', async () => {
    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Student One/i).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /suspend account/i }));
    const dialog = screen.getByRole('dialog', { name: /Suspend this account/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /Cancel/i }));

    expect(updateAdminUserStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses a non-destructive confirmation before activating an account', async () => {
    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activate account/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /activate account/i }));

    expect(updateAdminUserStatus).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: /Activate this account/i });
    const confirmButton = within(dialog).getByRole('button', { name: /Activate account/i });
    expect(confirmButton).not.toHaveClass('bg-feedback-danger');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(updateAdminUserStatus).toHaveBeenCalledWith(3, 'active');
    });
  });

  it('shows an honest empty state when the user list is empty', async () => {
    listAdminUsers.mockImplementation((params = {}) => {
      if (params.role === 'lecturer') {
        return Promise.resolve(lecturerOptionsResponse);
      }

      if (params.role === 'student') {
        return Promise.resolve(studentOptionsResponse);
      }

      return Promise.resolve({
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
    });

    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/No user records/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No accounts match the selected filters/i)).toBeInTheDocument();
  });

  it('shows unavailable states when the users endpoint fails', async () => {
    listAdminUsers.mockImplementation((params = {}) => {
      if (params.role === 'lecturer') {
        return Promise.resolve(lecturerOptionsResponse);
      }

      if (params.role === 'student') {
        return Promise.resolve(studentOptionsResponse);
      }

      return Promise.reject(new Error('users unavailable'));
    });

    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/User records unavailable/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/User records could not be loaded/i).length).toBeGreaterThanOrEqual(1);
  });

  it('does not expose unsupported account actions', async () => {
    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(listAdminUsers).toHaveBeenCalled();
    });

    expect(screen.queryByRole('button', { name: /add user/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset password/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change role/i })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renders real active supervisee assignments without fake relationships', async () => {
    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(listAdminSuperviseeAssignments).toHaveBeenCalledWith({
        status: 'active',
        limit: 25
      });
    });

    expect(screen.getByRole('heading', { name: /lecturer-supervisee assignments/i })).toBeInTheDocument();
    expect(screen.getAllByText('lecturer.one@example.edu').length).toBeGreaterThan(0);
    expect(screen.getAllByText('student.one@example.edu').length).toBeGreaterThan(0);
    expect(screen.queryByText(/sample supervisee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fake assignment/i)).not.toBeInTheDocument();
  });

  it('creates an audited assignment from real selected users', async () => {
    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/lecturer/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/lecturer/i), {
      target: { name: 'lecturerId', value: '3' }
    });
    fireEvent.change(screen.getByLabelText(/student/i), {
      target: { name: 'studentId', value: '2' }
    });
    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { name: 'notes', value: 'Department-approved allocation.' }
    });
    fireEvent.click(screen.getByRole('button', { name: /create assignment/i }));

    await waitFor(() => {
      expect(createAdminSuperviseeAssignment).toHaveBeenCalledWith({
        lecturerId: 3,
        studentId: 2,
        notes: 'Department-approved allocation.'
      });
      expect(screen.getByText(/Supervisee assignment created/i)).toBeInTheDocument();
    });
  });

  it('ends assignment with a soft audited action', async () => {
    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /end assignment/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /end assignment/i }));

    await waitFor(() => {
      expect(endAdminSuperviseeAssignment).toHaveBeenCalledWith(10);
      expect(screen.getByText(/Assignment ended for student.one@example.edu/i)).toBeInTheDocument();
    });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('lecturer.one@example.edu'));
  });

  it('provisions an individual student and shows the one-time credential exactly once', async () => {
    createAdminUser.mockResolvedValue({
      data: {
        item: {
          id: 20,
          name: 'Synthetic Student',
          email: 'synthetic.student@example.edu',
          role: 'student',
          status: 'active',
          matricNumber: 'CSC/21/0451',
          mustChangePassword: true,
          createdAt: '2026-08-20T09:00:00.000Z',
          updatedAt: '2026-08-20T09:00:00.000Z'
        },
        temporaryPassword: 'GeneratedTemp9x'
      },
      meta: {
        auditEventType: 'USER_PROVISIONED'
      }
    });

    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Synthetic Student' }
    });
    fireEvent.change(screen.getByLabelText(/university email/i), {
      target: { value: 'synthetic.student@example.edu' }
    });
    fireEvent.change(screen.getByLabelText(/matric number/i), {
      target: { value: 'CSC/21/0451' }
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(createAdminUser).toHaveBeenCalledWith({
        role: 'student',
        name: 'Synthetic Student',
        email: 'synthetic.student@example.edu',
        matricNumber: 'CSC/21/0451'
      });
    });

    expect(await screen.findByText('GeneratedTemp9x')).toBeInTheDocument();
    expect(screen.getByText(/it will not be shown again/i)).toBeInTheDocument();
    expect(screen.getByText(/change it at first login/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('GeneratedTemp9x')).not.toBeInTheDocument();

    // The credential lives only in component state; nothing is persisted.
    expect(window.localStorage.getItem('temporaryPassword')).toBeNull();
    expect(Object.keys(window.localStorage).join(' ')).not.toContain('credential');
  });

  it('provisions a lecturer without offering a matric field', async () => {
    createAdminUser.mockResolvedValue({
      data: {
        item: {
          id: 21,
          name: 'Synthetic Lecturer',
          email: 'synthetic.lecturer@example.edu',
          role: 'lecturer',
          status: 'active',
          matricNumber: null,
          mustChangePassword: true
        },
        temporaryPassword: 'LecturerTemp7q'
      },
      meta: {}
    });

    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    const provisionSection = screen
      .getByRole('heading', { name: /create individual account/i })
      .closest('section');
    fireEvent.change(within(provisionSection).getByLabelText(/role/i), {
      target: { name: 'role', value: 'lecturer' }
    });
    expect(screen.queryByLabelText(/matric number/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Synthetic Lecturer' }
    });
    fireEvent.change(screen.getByLabelText(/university email/i), {
      target: { value: 'synthetic.lecturer@example.edu' }
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(createAdminUser).toHaveBeenCalledWith({
        role: 'lecturer',
        name: 'Synthetic Lecturer',
        email: 'synthetic.lecturer@example.edu'
      });
    });
    expect(await screen.findByText('LecturerTemp7q')).toBeInTheDocument();
  });

  it('shows backend provisioning errors without a credential panel', async () => {
    createAdminUser.mockRejectedValue({
      response: {
        data: {
          error: {
            code: 'USER_PROVISION_EMAIL_EXISTS',
            message: 'An account with this email already exists.'
          }
        }
      }
    });

    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Duplicate Student' }
    });
    fireEvent.change(screen.getByLabelText(/university email/i), {
      target: { value: 'student.one@example.edu' }
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/an account with this email already exists/i)).toBeInTheDocument();
    expect(screen.queryByText(/one-time temporary password/i)).not.toBeInTheDocument();
  });

  it('resets a credential after confirmation and shows the replacement once', async () => {
    resetAdminUserCredential.mockResolvedValue({
      data: {
        item: {
          id: 2,
          name: 'Student One',
          email: 'student.one@example.edu',
          role: 'student',
          status: 'active',
          matricNumber: null,
          mustChangePassword: true,
          createdAt: '2026-06-02T10:00:00.000Z',
          updatedAt: '2026-08-20T09:00:00.000Z'
        },
        temporaryPassword: 'ReplacementTemp5z'
      },
      meta: {
        auditEventType: 'USER_CREDENTIAL_RESET'
      }
    });

    render(<AdminUserManagementPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /reset credential/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /reset credential/i })[0]);

    expect(await screen.findByText(/reset this account's credential\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /issue new temporary password/i }));

    await waitFor(() => {
      expect(resetAdminUserCredential).toHaveBeenCalledWith(2);
    });
    expect(await screen.findByText('ReplacementTemp5z')).toBeInTheDocument();
  });

  it('never offers credential reset for admin accounts or the current admin', async () => {
    render(<AdminUserManagementPage />);

    // Three listed users: current admin (no reset), student and lecturer (reset).
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /reset credential/i })).toHaveLength(2);
    });
  });
});
