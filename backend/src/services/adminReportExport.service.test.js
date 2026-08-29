const {
  AUDIT_EVENT_TYPES
} = require('./auditLog.service');
const {
  AdminReportExportServiceError,
  CSV_CONTENT_TYPE,
  createAdminReportExportService,
  createCsv,
  csvEscape
} = require('./adminReportExport.service');

function createPrismaMock() {
  return {
    auditLog: {
      findMany: jest.fn()
    },
    currentSessionTopic: {
      findMany: jest.fn()
    },
    historicalTopic: {
      findMany: jest.fn()
    },
    lecturerSuperviseeAssignment: {
      findMany: jest.fn()
    },
    similarityCheckSnapshot: {
      findMany: jest.fn()
    },
    submission: {
      findMany: jest.fn()
    },
    underReviewTopic: {
      findMany: jest.fn()
    },
    user: {
      findMany: jest.fn()
    }
  };
}

describe('adminReportExport.service', () => {
  test('escapes CSV values with commas, quotes, and newlines', () => {
    expect(csvEscape('plain value')).toBe('plain value');
    expect(csvEscape('value, with comma')).toBe('"value, with comma"');
    expect(csvEscape('value "with quotes"')).toBe('"value ""with quotes"""');
    expect(csvEscape('line one\nline two')).toBe('"line one\nline two"');
  });

  test('creates header-only CSV for empty datasets', () => {
    expect(createCsv(['id', 'name'], [])).toBe('id,name\n');
  });

  test('exports safe user fields and audits the export', async () => {
    const prisma = createPrismaMock();
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    prisma.user.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Ada, "Admin"',
        email: 'ada.admin@example.edu',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date('2026-06-01T10:00:00.000Z'),
        updatedAt: new Date('2026-06-01T11:00:00.000Z'),
        passwordHash: 'must-not-export'
      }
    ]);

    const service = createAdminReportExportService({ prismaClient: prisma, audit });
    const result = await service.exportReport({
      type: 'users',
      query: { role: 'admin' },
      req: {
        user: { id: 9, role: 'admin', email: 'root@example.edu' },
        headers: {},
        get: jest.fn()
      }
    });

    expect(result.contentType).toBe(CSV_CONTENT_TYPE);
    expect(result.filename).toMatch(/^admin-users-export-/);
    expect(result.body).toContain('id,name,email,role,status,createdAt,updatedAt');
    expect(result.body).toContain('"Ada, ""Admin"""');
    expect(result.body).not.toContain('passwordHash');
    expect(result.body).not.toContain('must-not-export');
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({
        passwordHash: true,
        resetTokenHash: true,
        resetTokenExpiresAt: true
      })
    }));
    expect(audit.createAuditLogSafely).toHaveBeenCalledWith(expect.objectContaining({
      eventType: AUDIT_EVENT_TYPES.REPORT_EXPORTED,
      actorId: 9,
      targetType: 'AdminReportExport',
      targetId: 'users',
      metadata: expect.objectContaining({
        exportType: 'users',
        rowCount: 1,
        filters: { role: 'admin' }
      })
    }));
  });

  test('exports topics without raw records or embeddings', async () => {
    const prisma = createPrismaMock();
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    prisma.historicalTopic.findMany.mockResolvedValue([
      {
        id: 1,
        title: 'Malaria prevention among children',
        keywords: 'malaria, children',
        category: 'Public Health',
        sessionYear: '2024/2025',
        supervisorName: 'Dr Supervisor',
        sourceType: 'import',
        sourceFilename: 'topics.xlsx',
        importBatchId: 'batch-1',
        createdAt: new Date('2026-06-01T10:00:00.000Z'),
        updatedAt: new Date('2026-06-01T10:30:00.000Z'),
        rawRecord: { secret: true },
        embedding: [0.1, 0.2]
      }
    ]);

    const service = createAdminReportExportService({ prismaClient: prisma, audit });
    const result = await service.exportReport({ type: 'topics', query: { lifecycle: 'historical' }, req: {} });

    expect(result.body).toContain('lifecycle,title,keywords');
    expect(result.body).toContain('historical');
    expect(result.body).not.toContain('rawRecord');
    expect(result.body).not.toContain('embedding');
    expect(prisma.historicalTopic.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({
        rawRecord: true,
        embedding: true
      })
    }));
  });

  test('exports similarity snapshots without raw result payloads or recommendations', async () => {
    const prisma = createPrismaMock();
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    prisma.similarityCheckSnapshot.findMany.mockResolvedValue([
      {
        id: 5,
        submissionId: 4,
        checkedById: 2,
        responseStatus: 'success',
        overallRisk: 'low',
        maxSimilarity: 0.22,
        createdAt: new Date('2026-06-01T10:00:00.000Z'),
        checkedBy: { name: 'Lecturer One', email: 'lecturer@example.edu' },
        submission: { title: 'A safe topic', category: 'AI', status: 'APPROVED' },
        resultSummary: { raw: true },
        recommendation: 'must-not-export'
      }
    ]);

    const service = createAdminReportExportService({ prismaClient: prisma, audit });
    const result = await service.exportReport({ type: 'similarity-snapshots', req: {} });

    expect(result.body).toContain('overallRisk,maxSimilarity');
    expect(result.body).toContain('low,0.22');
    expect(result.body).not.toContain('resultSummary');
    expect(result.body).not.toContain('must-not-export');
    expect(prisma.similarityCheckSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({
        resultSummary: true,
        recommendation: true
      })
    }));
  });

  test('exports supervisee assignments without notes', async () => {
    const prisma = createPrismaMock();
    const audit = { createAuditLogSafely: jest.fn().mockResolvedValue(null) };
    prisma.lecturerSuperviseeAssignment.findMany.mockResolvedValue([
      {
        id: 8,
        isActive: true,
        assignedAt: new Date('2026-06-01T10:00:00.000Z'),
        endedAt: null,
        notes: 'private internal note',
        lecturer: { id: 2, name: 'Lecturer One', email: 'lecturer@example.edu' },
        student: { id: 3, name: 'Student One', matricNumber: 'PHS/22/0042', email: 'student@example.edu' },
        assignedBy: { id: 1, name: 'Admin One', email: 'admin@example.edu' }
      }
    ]);

    const service = createAdminReportExportService({ prismaClient: prisma, audit });
    const result = await service.exportReport({ type: 'supervisee-assignments', req: {} });

    expect(result.body).toContain('lecturerEmail,studentId');
    expect(result.body).toContain('student@example.edu');
    // Students are identified by matric number; the column sits with the
    // student identity and the email column is retained.
    expect(result.body).toContain('studentName,studentMatricNumber,studentEmail');
    expect(result.body).toContain('PHS/22/0042');
    expect(prisma.lecturerSuperviseeAssignment.findMany.mock.calls[0][0].include.student.select.matricNumber).toBe(true);
    expect(result.body).not.toContain('notes');
    expect(result.body).not.toContain('private internal note');
  });

  test('rejects unsupported export types', async () => {
    const service = createAdminReportExportService({
      prismaClient: createPrismaMock(),
      audit: { createAuditLogSafely: jest.fn() }
    });

    await expect(service.exportReport({ type: 'pdf' })).rejects.toMatchObject({
      name: 'AdminReportExportServiceError',
      code: 'ADMIN_REPORT_EXPORT_INVALID_TYPE',
      statusCode: 400
    });
  });

  test('returns header-only audit log export for empty datasets', async () => {
    const prisma = createPrismaMock();
    prisma.auditLog.findMany.mockResolvedValue([]);
    const service = createAdminReportExportService({
      prismaClient: prisma,
      audit: { createAuditLogSafely: jest.fn().mockResolvedValue(null) }
    });

    const result = await service.exportReport({ type: 'audit-logs', req: {} });

    expect(result.body).toBe('id,eventType,actorId,actorRole,actorEmail,targetType,targetId,requestId,createdAt\n');
    expect(result.rowCount).toBe(0);
  });
});
