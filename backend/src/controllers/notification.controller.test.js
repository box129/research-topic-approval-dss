const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn(),
  getClearCookieOptions: jest.fn(() => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  })),
  getCookieOptions: jest.fn(() => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }))
}));

jest.mock('../services/notification.service', () => ({
  listNotificationsForUser: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn()
}));

const authService = require('../services/auth.service');
const notificationService = require('../services/notification.service');
const app = require('../server');

const activeUser = {
  id: 7,
  name: 'Student Demo',
  email: 'student.demo@uniosun.edu.ng',
  role: 'student',
  status: 'active'
};

describe('Notification API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/v1/notifications rejects unauthenticated users', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .get('/api/v1/notifications')
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(notificationService.listNotificationsForUser).not.toHaveBeenCalled();
  });

  test('authenticated user can list own notifications', async () => {
    authService.authenticateToken.mockResolvedValue(activeUser);
    notificationService.listNotificationsForUser.mockResolvedValue({
      data: {
        items: [
          {
            id: 1,
            userId: 7,
            type: 'SYSTEM',
            title: 'Notice',
            message: 'A real notification.',
            metadata: null,
            readAt: null,
            createdAt: '2026-06-19T10:00:00.000Z',
            updatedAt: '2026-06-19T10:00:00.000Z'
          }
        ]
      },
      meta: {
        pagination: {
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        },
        unreadCount: 1
      }
    });

    const response = await request(app)
      .get('/api/v1/notifications')
      .set('Cookie', ['rtadss_session=signed-test-token'])
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        items: [
          {
            id: 1,
            userId: 7,
            type: 'SYSTEM',
            title: 'Notice',
            message: 'A real notification.',
            metadata: null,
            readAt: null,
            createdAt: '2026-06-19T10:00:00.000Z',
            updatedAt: '2026-06-19T10:00:00.000Z'
          }
        ]
      },
      meta: {
        pagination: {
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        },
        unreadCount: 1
      }
    });
    expect(notificationService.listNotificationsForUser).toHaveBeenCalledWith(7, {});
  });

  test('empty notification list returns items array', async () => {
    authService.authenticateToken.mockResolvedValue(activeUser);
    notificationService.listNotificationsForUser.mockResolvedValue({
      data: { items: [] },
      meta: {
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        },
        unreadCount: 0,
        dataCoverage: 'No notifications found for this user.'
      }
    });

    const response = await request(app)
      .get('/api/v1/notifications')
      .set('Cookie', ['rtadss_session=signed-test-token'])
      .expect(200);

    expect(response.body.data.items).toEqual([]);
    expect(response.body.meta.pagination.total).toBe(0);
  });

  test('user can mark own notification as read', async () => {
    authService.authenticateToken.mockResolvedValue(activeUser);
    notificationService.markNotificationRead.mockResolvedValue({
      id: 2,
      userId: 7,
      type: 'SYSTEM',
      title: 'Notice',
      message: 'A real notification.',
      metadata: null,
      readAt: '2026-06-19T10:05:00.000Z',
      createdAt: '2026-06-19T10:00:00.000Z',
      updatedAt: '2026-06-19T10:00:00.000Z'
    });

    const response = await request(app)
      .patch('/api/v1/notifications/2/read')
      .set('Cookie', ['rtadss_session=signed-test-token'])
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        item: {
          id: 2,
          userId: 7,
          readAt: '2026-06-19T10:05:00.000Z'
        }
      },
      meta: {
        mutationStatus: 'read'
      }
    });
    expect(notificationService.markNotificationRead).toHaveBeenCalledWith({
      id: '2',
      userId: 7
    });
  });

  test('user cannot mark another user notification as read', async () => {
    authService.authenticateToken.mockResolvedValue(activeUser);
    notificationService.markNotificationRead.mockResolvedValue(null);

    const response = await request(app)
      .patch('/api/v1/notifications/99/read')
      .set('Cookie', ['rtadss_session=signed-test-token'])
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification record not found.'
      }
    });
  });

  test('user can mark all own notifications as read', async () => {
    authService.authenticateToken.mockResolvedValue(activeUser);
    notificationService.markAllNotificationsRead.mockResolvedValue({
      updatedCount: 2,
      readAt: '2026-06-19T10:05:00.000Z'
    });

    const response = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Cookie', ['rtadss_session=signed-test-token'])
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        updatedCount: 2,
        readAt: '2026-06-19T10:05:00.000Z'
      },
      meta: {
        mutationStatus: 'read_all'
      }
    });
    expect(notificationService.markAllNotificationsRead).toHaveBeenCalledWith(7);
  });
});
