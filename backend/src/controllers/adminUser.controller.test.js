const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/adminUser.service', () => ({
  listUsers: jest.fn(),
  getUserById: jest.fn(),
  updateUserStatus: jest.fn()
}));

const authService = require('../services/auth.service');
const adminUserService = require('../services/adminUser.service');
const app = require('../server');

const adminUser = {
  id: 1,
  name: 'Admin Demo',
  email: 'admin.demo@uniosun.edu.ng',
  role: 'admin',
  status: 'active'
};

const lecturerUser = {
  id: 2,
  name: 'Lecturer Demo',
  email: 'lecturer.demo@uniosun.edu.ng',
  role: 'lecturer',
  status: 'active'
};

const usersList = {
  data: {
    items: [
      {
        id: 2,
        name: 'Lecturer Demo',
        email: 'lecturer.demo@uniosun.edu.ng',
        role: 'lecturer',
        status: 'active',
        createdAt: '2026-06-06T10:00:00.000Z',
        updatedAt: '2026-06-06T10:00:00.000Z'
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
    filters: {
      role: 'lecturer',
      status: 'active',
      search: null,
      sort: 'createdAt',
      direction: 'desc'
    },
    generatedAt: '2026-06-06T10:00:00.000Z',
    dataCoverage: 'Read-only users from existing User records.'
  }
};

describe('Admin users API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('admin can list users', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminUserService.listUsers.mockResolvedValue(usersList);

    const response = await request(app)
      .get('/api/v1/admin/users?role=lecturer&status=active')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: usersList.data,
      meta: usersList.meta
    });
    expect(adminUserService.listUsers).toHaveBeenCalledWith({
      role: 'lecturer',
      status: 'active'
    });
  });

  test('admin can fetch user detail', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminUserService.getUserById.mockResolvedValue(usersList.data.items[0]);

    const response = await request(app)
      .get('/api/v1/admin/users/2')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        item: usersList.data.items[0]
      },
      meta: {
        dataCoverage: 'Read-only user detail from existing User records.'
      }
    });
  });

  test('missing user detail returns 404', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminUserService.getUserById.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/v1/admin/users/999')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'User record not found.'
      }
    });
  });

  test('admin can update another user status', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminUserService.updateUserStatus.mockResolvedValue({
      ...usersList.data.items[0],
      status: 'suspended'
    });

    const response = await request(app)
      .patch('/api/v1/admin/users/2/status')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .send({ status: 'suspended' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        item: {
          ...usersList.data.items[0],
          status: 'suspended'
        }
      },
      meta: {
        auditEventType: 'USER_STATUS_CHANGED'
      }
    });
    expect(adminUserService.updateUserStatus).toHaveBeenCalledWith({
      id: '2',
      status: 'suspended',
      actor: adminUser,
      req: expect.any(Object)
    });
  });

  test('validation errors use the admin user error envelope', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    const error = new Error('Unsupported status value.');
    error.name = 'AdminUserServiceError';
    error.code = 'ADMIN_USER_INVALID_STATUS';
    error.field = 'status';
    error.statusCode = 400;
    adminUserService.updateUserStatus.mockRejectedValue(error);

    const response = await request(app)
      .patch('/api/v1/admin/users/2/status')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .send({ status: 'disabled' })
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'ADMIN_USER_INVALID_STATUS',
        message: 'Unsupported status value.',
        field: 'status'
      }
    });
  });

  test('non-admin users cannot list users', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);

    const response = await request(app)
      .get('/api/v1/admin/users')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(adminUserService.listUsers).not.toHaveBeenCalled();
  });

  test('unauthenticated users cannot list users', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .get('/api/v1/admin/users')
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(adminUserService.listUsers).not.toHaveBeenCalled();
  });

  test('user response excludes sensitive fields', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminUserService.listUsers.mockResolvedValue(usersList);

    const response = await request(app)
      .get('/api/v1/admin/users')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body.data.items[0]).not.toHaveProperty('passwordHash');
    expect(response.body.data.items[0]).not.toHaveProperty('resetTokenHash');
    expect(response.body.data.items[0]).not.toHaveProperty('resetTokenExpiresAt');
  });
});
