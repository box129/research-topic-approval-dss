const {
  normalizeTitle,
  auditTopicRecords,
  runTopicDataQualityAudit,
  SAFE_SELECT
} = require('./topicDataQualityAudit.service');

describe('Topic Data Quality Audit Service', () => {
  test('should normalize titles for duplicate candidate detection', () => {
    expect(normalizeTitle('  Malaria: Prevention Among Mothers! ')).toBe('malaria prevention among mothers');
  });

  test('should summarize lifecycle data quality without raw titles', () => {
    const report = auditTopicRecords({
      historical: [
        {
          id: 1,
          title: 'Knowledge of malaria prevention',
          category: 'Public Health',
          keywords: 'malaria; prevention',
          sessionYear: '2024/2025',
          supervisorName: 'Dr A',
          population: 'Mothers',
          location: 'Osogbo',
          studyFocus: 'Prevention knowledge',
          importWarnings: [],
          sourceType: 'xlsx',
          importBatchId: 'batch-001',
          embedding: [0.1, 0.2]
        },
        {
          id: 2,
          title: ' ',
          category: '',
          keywords: null,
          sessionYear: '',
          supervisorName: '',
          population: '',
          location: null,
          studyFocus: undefined,
          importWarnings: [{ code: 'MISSING_CONTEXT_FIELD' }],
          sourceType: '',
          importBatchId: null,
          embedding: null
        }
      ],
      currentSession: [],
      underReview: []
    }, { mode: 'fixture' });

    expect(report.mode).toBe('fixture');
    expect(report.dataSafety).toEqual({
      readOnly: true,
      rawTitlesIncluded: false,
      duplicateTitlesHashed: true,
      mutatesDatabase: false
    });
    expect(report.byLifecycle.historical).toMatchObject({
      total: 2,
      blankTitle: 1,
      missingCategory: 1,
      missingSessionYear: 1,
      missingSupervisorName: 1,
      missingKeywords: 1,
      missingPopulation: 1,
      missingLocation: 1,
      missingStudyFocus: 1,
      incompleteContext: 1,
      withEmbeddings: 1,
      withoutEmbeddings: 1,
      withImportWarnings: 1
    });
    expect(JSON.stringify(report)).not.toContain('Knowledge of malaria prevention');
  });

  test('should identify within- and across-lifecycle duplicate title candidates by hash', () => {
    const report = auditTopicRecords({
      historical: [
        { id: 1, title: 'Malaria prevention among mothers', embedding: null },
        { id: 2, title: 'Malaria prevention among mothers', embedding: null }
      ],
      currentSession: [
        { id: 3, title: 'Malaria prevention among mothers', embedding: null }
      ],
      underReview: [
        { id: 4, title: 'Different topic', embedding: null }
      ]
    });

    expect(report.duplicateTitleCandidates).toMatchObject({
      totalCandidateGroups: 1,
      acrossLifecycleGroups: 1,
      withinLifecycleGroups: 0
    });
    expect(report.duplicateTitleCandidates.candidates[0]).toMatchObject({
      count: 3,
      scope: 'across_lifecycle',
      lifecycles: ['currentSession', 'historical']
    });
    expect(report.duplicateTitleCandidates.candidates[0].normalizedTitleHash).toHaveLength(16);
    expect(report.duplicateTitleCandidates.candidates[0]).not.toHaveProperty('normalizedTitle');
  });

  test('should query only safe fields when using a prisma client', async () => {
    const prismaClient = {
      historicalTopic: { findMany: jest.fn().mockResolvedValue([]) },
      currentSessionTopic: { findMany: jest.fn().mockResolvedValue([]) },
      underReviewTopic: { findMany: jest.fn().mockResolvedValue([]) }
    };

    const report = await runTopicDataQualityAudit({ prismaClient });

    expect(report.mode).toBe('database');
    expect(prismaClient.historicalTopic.findMany).toHaveBeenCalledWith({ select: SAFE_SELECT });
    expect(prismaClient.currentSessionTopic.findMany).toHaveBeenCalledWith({ select: SAFE_SELECT });
    expect(prismaClient.underReviewTopic.findMany).toHaveBeenCalledWith({ select: SAFE_SELECT });
    expect(report.totals.total).toBe(0);
  });
});
