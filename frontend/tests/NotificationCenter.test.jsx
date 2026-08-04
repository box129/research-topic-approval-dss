import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AuthenticatedTopNav from '../src/layouts/AuthenticatedTopNav';
import LoginPage from '../src/pages/auth/LoginPage';
import { useAuth } from '../src/auth/useAuth';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../src/api/notifications';

vi.mock('../src/auth/useAuth', () => ({
  useAuth: vi.fn()
}));

vi.mock('../src/api/notifications', () => ({
  listNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn()
}));

function renderTopNav(role = 'student') {
  useAuth.mockReturnValue({
    logout: vi.fn(),
    user: {
      id: 7,
      name: `${role} User`,
      role
    }
  });

  return render(
    <MemoryRouter>
      <AuthenticatedTopNav role={role} />
    </MemoryRouter>
  );
}

function renderLoginPage() {
  useAuth.mockReturnValue({
    login: vi.fn()
  });

  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

const unreadNotification = {
  id: 1,
  userId: 7,
  type: 'SUBMISSION_DECISION',
  title: 'Topic approved',
  message: 'Your topic submission was approved.',
  linkPath: '/student/my-submissions',
  metadata: null,
  readAt: null,
  createdAt: '2026-06-22T10:00:00.000Z',
  updatedAt: '2026-06-22T10:00:00.000Z'
};

const readNotification = {
  id: 2,
  userId: 7,
  type: 'SYSTEM',
  title: 'System notice',
  message: 'A real system notification.',
  linkPath: null,
  metadata: null,
  readAt: '2026-06-22T10:05:00.000Z',
  createdAt: '2026-06-22T09:00:00.000Z',
  updatedAt: '2026-06-22T10:05:00.000Z'
};

function mockNotificationList({ items = [], unreadCount = 0 } = {}) {
  listNotifications.mockResolvedValue({
    data: { items },
    meta: {
      unreadCount,
      pagination: {
        page: 1,
        limit: 10,
        total: items.length,
        totalPages: items.length ? 1 : 0,
        hasNextPage: false,
        hasPreviousPage: false
      }
    }
  });
}

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['student', 'lecturer', 'admin'])('renders notification trigger for authenticated %s shell', async (role) => {
    mockNotificationList();
    renderTopNav(role);

    expect(screen.getByRole('button', { name: /open notifications/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(listNotifications).toHaveBeenCalledWith({ limit: 10 });
    });
  });

  it('shows loading state while notifications are pending', async () => {
    const user = userEvent.setup();
    listNotifications.mockReturnValue(new Promise(() => {}));
    renderTopNav('student');

    await user.click(screen.getByRole('button', { name: /open notifications/i }));

    expect(screen.getByText(/loading notifications/i)).toBeInTheDocument();
  });

  it('shows unread count and lists real API notifications', async () => {
    const user = userEvent.setup();
    mockNotificationList({
      items: [unreadNotification, readNotification],
      unreadCount: 1
    });
    renderTopNav('student');

    expect(await screen.findByLabelText(/1 unread notifications/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open notifications/i }));

    expect(screen.getByRole('dialog', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByText(/topic approved/i)).toBeInTheDocument();
    expect(screen.getByText(/your topic submission was approved/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute('href', '/student/my-submissions');
    expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
  });

  it('shows honest empty state when API returns no notifications', async () => {
    const user = userEvent.setup();
    mockNotificationList();
    renderTopNav('lecturer');

    await waitFor(() => expect(listNotifications).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /open notifications/i }));

    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/unread notifications/i)).not.toBeInTheDocument();
  });

  it('shows error state and retries notification loading', async () => {
    const user = userEvent.setup();
    listNotifications
      .mockRejectedValueOnce({
        response: {
          data: {
            error: {
              message: 'Unable to load notification records.'
            }
          }
        }
      })
      .mockResolvedValueOnce({
        data: { items: [readNotification] },
        meta: { unreadCount: 0 }
      });
    renderTopNav('admin');

    await user.click(screen.getByRole('button', { name: /open notifications/i }));
    expect(await screen.findByText(/unable to load notification records/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText(/system notice/i)).toBeInTheDocument();
    expect(listNotifications).toHaveBeenCalledTimes(2);
  });

  it('marks one notification as read and updates the unread count honestly', async () => {
    const user = userEvent.setup();
    mockNotificationList({
      items: [unreadNotification],
      unreadCount: 1
    });
    markNotificationRead.mockResolvedValue({
      data: {
        item: {
          ...unreadNotification,
          readAt: '2026-06-22T10:10:00.000Z'
        }
      },
      meta: { mutationStatus: 'read' }
    });
    renderTopNav('student');

    expect(await screen.findByLabelText(/1 unread notifications/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open notifications/i }));
    await user.click(screen.getByRole('button', { name: /mark read/i }));

    await waitFor(() => {
      expect(markNotificationRead).toHaveBeenCalledWith(1);
    });
    expect(screen.queryByLabelText(/1 unread notifications/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark read/i })).not.toBeInTheDocument();
  });

  it('keeps state honest when marking one notification fails', async () => {
    const user = userEvent.setup();
    mockNotificationList({
      items: [unreadNotification],
      unreadCount: 1
    });
    markNotificationRead.mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Unable to mark notification as read.'
          }
        }
      }
    });
    renderTopNav('student');

    expect(await screen.findByLabelText(/1 unread notifications/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open notifications/i }));
    await user.click(screen.getByRole('button', { name: /mark read/i }));

    expect(await screen.findByText(/unable to mark notification as read/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/1 unread notifications/i)).toBeInTheDocument();
  });

  it('marks all notifications as read and updates count/list', async () => {
    const user = userEvent.setup();
    mockNotificationList({
      items: [
        unreadNotification,
        {
          ...unreadNotification,
          id: 3,
          title: 'Import committed',
          type: 'TOPIC_IMPORT_COMMITTED'
        }
      ],
      unreadCount: 2
    });
    markAllNotificationsRead.mockResolvedValue({
      data: {
        updatedCount: 2,
        readAt: '2026-06-22T10:20:00.000Z'
      },
      meta: { mutationStatus: 'read_all' }
    });
    renderTopNav('admin');

    expect(await screen.findByLabelText(/2 unread notifications/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open notifications/i }));
    const panel = screen.getByRole('dialog', { name: /notifications/i });
    await user.click(within(panel).getByRole('button', { name: /mark all read/i }));

    await waitFor(() => {
      expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByLabelText(/2 unread notifications/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /mark read/i })).toHaveLength(0);
  });

  it('does not render notification UI on unauthenticated auth pages', () => {
    renderLoginPage();

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open notifications/i })).not.toBeInTheDocument();
    expect(listNotifications).not.toHaveBeenCalled();
  });
});
