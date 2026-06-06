const prisma = require('../config/database');

const DATA_COVERAGE = 'Read-only settings from SystemSetting table.';

function toIso(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function serializeSetting(setting) {
  if (!setting) {
    return null;
  }

  return {
    key: setting.key,
    value: setting.value,
    updatedAt: toIso(setting.updatedAt),
    updatedBy: setting.updatedBy
      ? {
        id: setting.updatedBy.id,
        name: setting.updatedBy.name,
        email: setting.updatedBy.email,
        role: String(setting.updatedBy.role || '').toLowerCase()
      }
      : null
  };
}

function createAdminSettingsService({ prismaClient = prisma } = {}) {
  const listSettings = async () => {
    const items = await prismaClient.systemSetting.findMany({
      orderBy: {
        key: 'asc'
      },
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

    return {
      data: {
        items: items.map(serializeSetting)
      },
      meta: {
        generatedAt: new Date().toISOString(),
        dataCoverage: DATA_COVERAGE,
        mutationStatus: 'Settings updates remain deferred until key-specific validation is approved.'
      }
    };
  };

  return {
    listSettings
  };
}

module.exports = {
  ...createAdminSettingsService(),
  createAdminSettingsService,
  serializeSetting,
  DATA_COVERAGE
};
