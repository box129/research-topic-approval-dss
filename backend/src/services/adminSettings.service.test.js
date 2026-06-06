const {
  DATA_COVERAGE,
  createAdminSettingsService
} = require('./adminSettings.service');

function createPrismaMock(items = []) {
  return {
    systemSetting: {
      findMany: jest.fn().mockResolvedValue(items)
    }
  };
}

describe('adminSettings.service', () => {
  test('lists real SystemSetting records with safe updater metadata', async () => {
    const prisma = createPrismaMock([
      {
        key: 'demo_auth_users_notice',
        value: 'Demo users are local-only and unsafe for production.',
        updatedAt: new Date('2026-06-06T10:00:00.000Z'),
        updatedBy: {
          id: 1,
          name: 'Admin Demo',
          email: 'admin.demo@uniosun.edu.ng',
          role: 'ADMIN'
        }
      }
    ]);
    const service = createAdminSettingsService({ prismaClient: prisma });

    const result = await service.listSettings();

    expect(prisma.systemSetting.findMany).toHaveBeenCalledWith({
      orderBy: { key: 'asc' },
      include: {
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });
    expect(result.data.items).toEqual([
      {
        key: 'demo_auth_users_notice',
        value: 'Demo users are local-only and unsafe for production.',
        updatedAt: '2026-06-06T10:00:00.000Z',
        updatedBy: {
          id: 1,
          name: 'Admin Demo',
          email: 'admin.demo@uniosun.edu.ng',
          role: 'admin'
        }
      }
    ]);
    expect(result.meta).toEqual({
      generatedAt: expect.any(String),
      dataCoverage: DATA_COVERAGE,
      mutationStatus: 'Settings updates remain deferred until key-specific validation is approved.'
    });
  });

  test('returns an honest empty settings list', async () => {
    const service = createAdminSettingsService({ prismaClient: createPrismaMock([]) });

    const result = await service.listSettings();

    expect(result.data.items).toEqual([]);
    expect(result.meta.dataCoverage).toBe(DATA_COVERAGE);
  });
});
