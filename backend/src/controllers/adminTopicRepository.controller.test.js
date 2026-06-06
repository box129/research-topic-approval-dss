const request = require('supertest');

jest.mock('../services/auth.service', () => ({
  authenticateToken: jest.fn()
}));

jest.mock('../services/adminTopicRepository.service', () => ({
  listTopics: jest.fn(),
  getTopicByLifecycleAndId: jest.fn(),
  getTopicsSummary: jest.fn()
}));

const authService = require('../services/auth.service');
const adminTopicRepositoryService = require('../services/adminTopicRepository.service');
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

const topicList = {
  data: {
    items: [
      {
        id: 1,
        lifecycle: 'historical',
        title: 'Malaria prevention in rural communities',
        category: 'Public Health',
        dataQuality: {
          hasEmbedding: true,
          hasContextFields: true,
          hasImportWarnings: false,
          importWarningCount: 0
        }
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
      lifecycle: 'all'
    },
    dataCoverage: 'Read-only topic data from existing lifecycle tables.'
  }
};

const topicSummary = {
  data: {
    totals: {
      all: 1,
      historical: 1,
      currentSession: 0,
      underReview: 0
    },
    byCategory: [{ category: 'Public Health', count: 1 }],
    bySessionYear: [{ sessionYear: '2023/2024', count: 1 }],
    dataQuality: {
      missingCategory: 0,
      missingSessionYear: 0,
      missingSupervisorName: 0,
      missingContextFields: 0,
      withEmbeddings: 1,
      withoutEmbeddings: 0,
      withImportWarnings: 0
    }
  },
  meta: {
    generatedAt: '2026-06-06T10:05:14.000Z',
    dataCoverage: 'Read-only aggregate counts from existing topic tables.'
  }
};

describe('Admin topic repository API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('admin can list read-only topic records', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminTopicRepositoryService.listTopics.mockResolvedValue(topicList);

    const response = await request(app)
      .get('/api/v1/admin/topics?lifecycle=historical&search=malaria')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: topicList.data,
      meta: topicList.meta
    });
    expect(adminTopicRepositoryService.listTopics).toHaveBeenCalledWith({
      lifecycle: 'historical',
      search: 'malaria'
    });
  });

  test('admin can read topic repository summary', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminTopicRepositoryService.getTopicsSummary.mockResolvedValue(topicSummary);

    const response = await request(app)
      .get('/api/v1/admin/topics/summary')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: topicSummary.data,
      meta: topicSummary.meta
    });
    expect(adminTopicRepositoryService.getTopicsSummary).toHaveBeenCalledTimes(1);
  });

  test('admin can read topic detail by lifecycle and id', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminTopicRepositoryService.getTopicByLifecycleAndId.mockResolvedValue({
      id: 1,
      lifecycle: 'historical',
      title: 'Malaria prevention in rural communities'
    });

    const response = await request(app)
      .get('/api/v1/admin/topics/historical/1')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        item: {
          id: 1,
          lifecycle: 'historical',
          title: 'Malaria prevention in rural communities'
        }
      },
      meta: {
        dataCoverage: 'Read-only topic detail from existing lifecycle tables.'
      }
    });
    expect(adminTopicRepositoryService.getTopicByLifecycleAndId).toHaveBeenCalledWith('historical', '1');
  });

  test('topic detail returns 404 when the record is missing', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminTopicRepositoryService.getTopicByLifecycleAndId.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/v1/admin/topics/historical/999')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'ADMIN_TOPIC_NOT_FOUND',
        message: 'Topic record not found for the requested lifecycle and id.'
      }
    });
  });

  test('validation errors use the admin repository error envelope', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    const error = new Error('Unsupported topic lifecycle filter.');
    error.name = 'AdminTopicRepositoryServiceError';
    error.code = 'ADMIN_TOPIC_REPOSITORY_INVALID_LIFECYCLE';
    error.field = 'lifecycle';
    error.statusCode = 400;
    adminTopicRepositoryService.listTopics.mockRejectedValue(error);

    const response = await request(app)
      .get('/api/v1/admin/topics?lifecycle=archived')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'ADMIN_TOPIC_REPOSITORY_INVALID_LIFECYCLE',
        message: 'Unsupported topic lifecycle filter.',
        field: 'lifecycle'
      }
    });
  });

  test('non-admin users cannot read topic repository endpoints', async () => {
    authService.authenticateToken.mockResolvedValue(lecturerUser);

    const response = await request(app)
      .get('/api/v1/admin/topics')
      .set('Cookie', ['rtadss_session=signed-lecturer-token'])
      .expect(403);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'FORBIDDEN'
      }
    });
    expect(adminTopicRepositoryService.listTopics).not.toHaveBeenCalled();
  });

  test('unauthenticated users cannot read topic repository endpoints', async () => {
    authService.authenticateToken.mockRejectedValue({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.'
    });

    const response = await request(app)
      .get('/api/v1/admin/topics')
      .expect(401);

    expect(response.body).toMatchObject({
      status: 'error',
      details: {
        error_code: 'AUTHENTICATION_REQUIRED'
      }
    });
    expect(adminTopicRepositoryService.listTopics).not.toHaveBeenCalled();
  });

  test('read-only endpoints do not expose mutation affordances', async () => {
    authService.authenticateToken.mockResolvedValue(adminUser);
    adminTopicRepositoryService.listTopics.mockResolvedValue(topicList);

    const response = await request(app)
      .get('/api/v1/admin/topics')
      .set('Cookie', ['rtadss_session=signed-admin-token'])
      .expect(200);

    expect(response.body).not.toHaveProperty('data.actions');
    expect(response.body).not.toHaveProperty('data.exports');
    expect(response.body).not.toHaveProperty('data.import');
    expect(response.body.data.items[0]).not.toHaveProperty('embedding');
  });
});
