const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/adminUser.service', () => ({
  listUsers: jest.fn(),
  getUserById: jest.fn(),
  updateUserStatus: jest.fn(),
  serializeUser: jest.fn()
}));

jest.mock('../services/userProvisioning.service', () => ({
  provisionUser: jest.fn(),
  resetUserCredential: jest.fn()
}));

const authService = require('../services/auth.service');
const adminUserService = require('../services/adminUser.service');
const userProvisioningService = require('../services/userProvisioning.service');
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

describe('Admin user provisioning routes', () => {
  const studentUser = {
    id: 3,
    name: 'Student Demo',
    email: 'student.demo@uniosun.edu.ng',
    role: 'student',
    status: 'active'
  };

  const provisionedStudent = {
    id: 10,
    name: 'Synthetic Student',
    email: 'synthetic.student@uniosun.edu.ng',
    role: 'student',
    status: 'active',
    matricNumber: 'CSC/21/0451',
    mustChangePassword: true,
    createdAt: '2026-08-20T09:00:00.000Z',
    updatedAt: '2026-08-20T09:00:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('admin can provision a user and receives the one-time credential exactly once', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    userProvisioningService.provisionUser.mockResolvedValue({
      user: provisionedStudent,
      temporaryPassword: 'GeneratedTemp9x'
    });

    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .send({
        name: 'Synthetic Student',
        email: 'synthetic.student@uniosun.edu.ng',
        role: 'student',
        matricNumber: 'CSC/21/0451'
      })
      .expect(201);

    expect(response.body.data.item).toEqual(provisionedStudent);
    expect(response.body.data.temporaryPassword).toBe('GeneratedTemp9x');
    expect(response.body.meta.credentialNotice).toMatch(/shown once/i);
    expect(userProvisioningService.provisionUser).toHaveBeenCalledWith({
      input: expect.objectContaining({ role: 'student' }),
      actor: adminUser,
      req: expect.any(Object)
    });
  });

  test('unauthenticated callers cannot provision users', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    await request(app)
      .post('/api/v1/admin/users')
      .send({ name: 'X', email: 'x@uniosun.edu.ng', role: 'student' })
      .expect(401);

    expect(userProvisioningService.provisionUser).not.toHaveBeenCalled();
  });

  test.each([
    ['student', () => studentUser],
    ['lecturer', () => lecturerUser]
  ])('%s role cannot provision users', async (_label, getUser) => {
    authService.authenticateToken.mockResolvedValue(getUser());

    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', ['rtadss_session=signed-token'])
      .send({ name: 'X', email: 'x@uniosun.edu.ng', role: 'student' })
      .expect(403);

    expect(response.body.details.error_code).toBe('FORBIDDEN');
    expect(userProvisioningService.provisionUser).not.toHaveBeenCalled();
  });

  test('provisioning service errors use the admin error envelope', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    const error = new Error('Only student or lecturer accounts can be provisioned here.');
    error.name = 'UserProvisioningError';
    error.code = 'USER_PROVISION_ROLE_NOT_ALLOWED';
    error.field = 'role';
    error.statusCode = 400;
    userProvisioningService.provisionUser.mockRejectedValue(error);

    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .send({ name: 'X', email: 'x@uniosun.edu.ng', role: 'admin' })
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'USER_PROVISION_ROLE_NOT_ALLOWED',
        message: 'Only student or lecturer accounts can be provisioned here.',
        field: 'role'
      }
    });
  });

  test('admin can reset a credential and receives the one-time replacement exactly once', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    userProvisioningService.resetUserCredential.mockResolvedValue({
      user: { ...provisionedStudent, mustChangePassword: true },
      temporaryPassword: 'ReplacementTemp7q'
    });

    const response = await request(app)
      .post('/api/v1/admin/users/10/credential-reset')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body.data.temporaryPassword).toBe('ReplacementTemp7q');
    expect(response.body.meta.auditEventType).toBe('USER_CREDENTIAL_RESET');
    expect(userProvisioningService.resetUserCredential).toHaveBeenCalledWith({
      id: '10',
      actor: adminUser,
      req: expect.any(Object)
    });
  });

  test('credential reset returns 404 for unknown users', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    userProvisioningService.resetUserCredential.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/v1/admin/users/999/credential-reset')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(404);

    expect(response.body.error.code).toBe('ADMIN_USER_NOT_FOUND');
  });

  test('non-admin roles cannot reset credentials', async () => {
    authService.authenticateToken.mockResolvedValue(studentUser);

    await request(app)
      .post('/api/v1/admin/users/10/credential-reset')
      .set('Cookie', ['rtadss_session=signed-token'])
      .expect(403);

    expect(userProvisioningService.resetUserCredential).not.toHaveBeenCalled();
  });
});
