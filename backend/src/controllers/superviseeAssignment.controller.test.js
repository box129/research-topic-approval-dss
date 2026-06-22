const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/superviseeAssignment.service', () => ({
  createAssignment: jest.fn(),
  endAssignment: jest.fn(),
  listAssignments: jest.fn(),
  listLecturerSupervisees: jest.fn(),
  updateAssignment: jest.fn()
}));

const authService = require('../services/auth.service');
const superviseeAssignmentService = require('../services/superviseeAssignment.service');
const app = require('../server');

const adminUser = {
  id: 1,
  name: 'Admin User',
  email: 'admin@example.edu',
  role: 'admin',
  status: 'active'
};

const lecturerUser = {
  id: 2,
  name: 'Lecturer One',
  email: 'lecturer.one@example.edu',
  role: 'lecturer',
  status: 'active'
};

const studentUser = {
  id: 3,
  name: 'Student One',
  email: 'student.one@example.edu',
  role: 'student',
  status: 'active'
};

const assignmentItem = {
  id: 10,
  lecturer: {
    id: 2,
    name: 'Lecturer One',
    email: 'lecturer.one@example.edu',
    role: 'lecturer',
    status: 'active'
  },
  student: {
    id: 3,
    name: 'Student One',
    email: 'student.one@example.edu',
    role: 'student',
    status: 'active'
  },
  assignedBy: {
    id: 1,
    name: 'Admin User',
    email: 'admin@example.edu',
    role: 'admin',
    status: 'active'
  },
  isActive: true,
  status: 'active',
  assignedAt: '2026-06-22T09:00:00.000Z',
  endedAt: null,
  notes: null,
  latestSubmission: null,
  createdAt: '2026-06-22T09:00:00.000Z',
  updatedAt: '2026-06-22T09:00:00.000Z'
};

describe('Supervisee assignment API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('admin can list supervisee assignments', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    superviseeAssignmentService.listAssignments.mockResolvedValue({
      data: { items: [assignmentItem] },
      meta: {
        pagination: {
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        }
      }
    });

    const response = await request(app)
      .get('/api/v1/admin/supervisee-assignments?status=active')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        items: [
          {
            id: 10,
            lecturer: {
              email: 'lecturer.one@example.edu'
            },
            student: {
              email: 'student.one@example.edu'
            }
          }
        ]
      }
    });
    expect(response.body.data.items[0].student).not.toHaveProperty('passwordHash');
    expect(superviseeAssignmentService.listAssignments).toHaveBeenCalledWith({
      status: 'active'
    });
  });

  test('admin can create assignment', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    superviseeAssignmentService.createAssignment.mockResolvedValue(assignmentItem);

    const response = await request(app)
      .post('/api/v1/admin/supervisee-assignments')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .send({
        lecturerId: 2,
        studentId: 3,
        notes: 'Assigned by department.'
      })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        item: {
          id: 10,
          status: 'active'
        }
      },
      meta: {
        auditEventType: 'SUPERVISEE_ASSIGNED'
      }
    });
    expect(superviseeAssignmentService.createAssignment).toHaveBeenCalledWith({
      actor: adminUser,
      input: expect.objectContaining({
        lecturerId: 2,
        studentId: 3
      }),
      req: expect.any(Object)
    });
  });

  test('admin can end assignment through delete route', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    superviseeAssignmentService.endAssignment.mockResolvedValue({
      ...assignmentItem,
      isActive: false,
      status: 'ended',
      endedAt: '2026-06-22T10:00:00.000Z'
    });

    const response = await request(app)
      .delete('/api/v1/admin/supervisee-assignments/10')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        item: {
          id: 10,
          status: 'ended'
        }
      },
      meta: {
        auditEventType: 'SUPERVISEE_ASSIGNMENT_ENDED'
      }
    });
    expect(superviseeAssignmentService.endAssignment).toHaveBeenCalledWith({
      id: '10',
      actor: adminUser,
      req: expect.any(Object)
    });
  });

  test('admin assignment validation errors use shared envelope', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    const error = new Error('An active assignment already exists for this lecturer and student.');
    error.name = 'SuperviseeAssignmentServiceError';
    error.code = 'SUPERVISEE_ASSIGNMENT_DUPLICATE_ACTIVE';
    error.field = 'studentId';
    error.statusCode = 409;
    superviseeAssignmentService.createAssignment.mockRejectedValue(error);

    const response = await request(app)
      .post('/api/v1/admin/supervisee-assignments')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .send({
        lecturerId: 2,
        studentId: 3
      })
      .expect(409);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'SUPERVISEE_ASSIGNMENT_DUPLICATE_ACTIVE',
        message: 'An active assignment already exists for this lecturer and student.',
        field: 'studentId'
      }
    });
  });

  test('lecturer can list only own supervisees', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);
    superviseeAssignmentService.listLecturerSupervisees.mockResolvedValue({
      data: {
        items: [assignmentItem]
      },
      meta: {
        dataCoverage: 'Active supervisee assignments for the authenticated lecturer.'
      }
    });

    const response = await request(app)
      .get('/api/v1/lecturer/supervisees')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        items: [
          {
            student: {
              name: 'Student One',
              email: 'student.one@example.edu'
            }
          }
        ]
      }
    });
    expect(superviseeAssignmentService.listLecturerSupervisees).toHaveBeenCalledWith({
      user: lecturerUser
    });
  });

  test('non-admin users cannot manage assignments', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);

    const response = await request(app)
      .post('/api/v1/admin/supervisee-assignments')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .send({
        lecturerId: 2,
        studentId: 3
      })
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(superviseeAssignmentService.createAssignment).not.toHaveBeenCalled();
  });

  test('non-lecturer users cannot read lecturer supervisees', async () => {
    authService.authenticateToken.mockResolvedValue(studentUser);

    const response = await request(app)
      .get('/api/v1/lecturer/supervisees')
      .set('Cookie', ['rtadss_session=signed-student-token'])
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(superviseeAssignmentService.listLecturerSupervisees).not.toHaveBeenCalled();
  });
});
