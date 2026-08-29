/**
 * Submission representation contract.
 *
 * The frozen production contract embeds a submitted topic from the same
 * structured-context-v1 canonical text as a direct similarity check. These
 * tests pin that down end to end: the pre-check path, the submission path and
 * the revision path must all hand the serializer semantically identical input,
 * blank fields must be the only thing ever omitted, and the surrounding
 * constants (provider, model, dimension, input types, thresholds) must be
 * untouched by the correction.
 */
const fs = require('fs');
const path = require('path');
const { serialize, sourceHash, REPRESENTATION_ID } = require('./topicSemanticRepresentation.service');
const { embedQuery, embedDocument, MODEL, DIMENSION, documentMetadata, validStoredEmbedding, VoyageProviderError } = require('./voyageEmbedding.service');
const { T1, T2, classify } = require('./voyageSemanticSimilarity.service');
const { buildSubmissionTopicShape } = require('./topicCorpusLifecycle.service');
const {
  createSubmissionService,
  normalizeSemanticContext,
  MAX_SEMANTIC_CONTEXT_LENGTH
} = require('./submission.service');

const TEST_VECTOR = Array(1024).fill(0).map((_, index) => (index === 0 ? 1 : 0));

// What a student types: the four semantic fields, plus the non-semantic
// category/keywords a submission also carries.
const SUPPLIED = {
  title: 'Knowledge of malaria prevention among mothers in Osogbo',
  population: 'Mothers of children under five',
  location: 'Osogbo',
  studyFocus: 'Malaria prevention knowledge',
  category: 'Public Health',
  keywords: 'malaria, prevention, mothers'
};

const EXPECTED_CANONICAL = [
  'Title: Knowledge of malaria prevention among mothers in Osogbo',
  'Population: Mothers of children under five',
  'Location: Osogbo',
  'Study focus: Malaria prevention knowledge'
].join('\n');

// PATH 1 — direct pre-check. similarity.controller destructures exactly these
// four fields from the request body and hands them to embedQuery.
function precheckShape(input) {
  return { title: input.title, population: input.population, location: input.location, studyFocus: input.studyFocus };
}

// PATH 2 — submission. submission.service normalises the request, then the
// corpus lifecycle builds the shape that reaches the serializer.
function submissionShape(input) {
  return buildSubmissionTopicShape({
    title: input.title,
    category: input.category,
    keywords: input.keywords,
    ...normalizeSemanticContext(input)
  });
}

function fetchCapturing(store) {
  return async (_, options) => {
    store.payload = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ data: [{ embedding: TEST_VECTOR }] }) };
  };
}

function minimalPrisma(overrides = {}) {
  const prisma = {
    academicSession: { findFirst: jest.fn().mockResolvedValue({ id: 3, name: '2025/2026' }) },
    submission: {
      create: jest.fn(async ({ data }) => ({ id: 22, ...data, session: { id: 3, name: '2025/2026' }, revisionOf: null, submittedAt: new Date(), createdAt: new Date(), updatedAt: new Date() })),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    },
    underReviewTopic: {
      create: jest.fn().mockResolvedValue({ id: 501 }),
      findUnique: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    currentSessionTopic: { upsert: jest.fn().mockResolvedValue({ id: 601 }) },
    user: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    notification: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    ...overrides
  };
  prisma.$transaction = jest.fn(async (callback) => callback(prisma));
  return prisma;
}

function lifecycleSpy() {
  return {
    buildSubmissionTopicShape,
    prepareDocumentEmbedding: jest.fn((shape) => Promise.resolve(documentMetadata(shape, TEST_VECTOR))),
    refreshResidentCorpusSafely: jest.fn().mockResolvedValue(true)
  };
}

const quietNotifications = {
  notifyReviewersOfSubmissionCreatedSafely: jest.fn().mockResolvedValue({ created: 0 }),
  notifyStudentOfSubmissionDecisionSafely: jest.fn().mockResolvedValue({ created: 0 })
};

describe('canonical representation across workflow paths', () => {
  test('1. direct pre-check with all fields serialises to the frozen canonical text', () => {
    expect(serialize(precheckShape(SUPPLIED))).toBe(EXPECTED_CANONICAL);
  });

  test('2. submission with all fields serialises to the frozen canonical text', () => {
    expect(serialize(submissionShape(SUPPLIED))).toBe(EXPECTED_CANONICAL);
  });

  test('3. pre-check and submission are byte-for-byte identical for the same semantic input', () => {
    const precheck = serialize(precheckShape(SUPPLIED));
    const submission = serialize(submissionShape(SUPPLIED));

    expect(submission).toBe(precheck);
    expect(Buffer.from(submission, 'utf8').equals(Buffer.from(precheck, 'utf8'))).toBe(true);
    expect(sourceHash(submissionShape(SUPPLIED))).toBe(sourceHash(precheckShape(SUPPLIED)));
  });

  test('4. a revision reaches the serializer through the same shape builder as a first submission', async () => {
    const original = {
      id: 21,
      studentId: 7,
      status: 'AWAITING_REVISION',
      title: 'An earlier title that the student is now revising for review',
      population: 'An earlier population',
      location: 'An earlier location',
      studyFocus: 'An earlier focus',
      revision: null
    };
    const prisma = minimalPrisma({
      submission: {
        findUnique: jest.fn().mockResolvedValue(original),
        create: jest.fn(async ({ data }) => ({ id: 22, ...data, session: { id: 3, name: '2025/2026' }, revisionOf: original, submittedAt: new Date(), createdAt: new Date(), updatedAt: new Date() })),
        update: jest.fn()
      }
    });
    const corpusLifecycle = lifecycleSpy();
    const service = createSubmissionService({ prismaClient: prisma, corpusLifecycle, notificationEvents: quietNotifications });

    await service.createRevisionSubmission({ user: { id: 7, role: 'student' }, submissionId: 21, input: SUPPLIED });
    await service.createSubmission({ user: { id: 7, role: 'student' }, input: SUPPLIED });

    const [revisionShape, submissionShapeSeen] = corpusLifecycle.prepareDocumentEmbedding.mock.calls.map(([shape]) => shape);
    expect(serialize(revisionShape)).toBe(EXPECTED_CANONICAL);
    expect(serialize(revisionShape)).toBe(serialize(submissionShapeSeen));
    // The revision embeds ITS OWN context, not the superseded original's.
    expect(serialize(revisionShape)).not.toMatch(/earlier/);
  });

  test('5. title-only still works when the context fields are genuinely absent', () => {
    const shape = submissionShape({ title: 'A title with no context supplied by the student' });

    expect(serialize(shape)).toBe('Title: A title with no context supplied by the student');
    expect(serialize(shape)).toBe(serialize(precheckShape({ title: 'A title with no context supplied by the student' })));
  });

  test('6. blank optional fields are omitted, and only blank ones', () => {
    const shape = submissionShape({ ...SUPPLIED, location: '   ', studyFocus: '' });

    expect(serialize(shape)).toBe([
      'Title: Knowledge of malaria prevention among mothers in Osogbo',
      'Population: Mothers of children under five'
    ].join('\n'));
  });

  test.each([
    ['7. population', { population: 'Secondary school adolescents' }],
    ['8. location', { location: 'Ibadan' }],
    ['9. study focus', { studyFocus: 'Treatment-seeking behaviour after diagnosis' }]
  ])('%s change changes the canonical source text and hash', (_, change) => {
    const before = submissionShape(SUPPLIED);
    const after = submissionShape({ ...SUPPLIED, ...change });

    expect(serialize(after)).not.toBe(serialize(before));
    expect(sourceHash(after)).not.toBe(sourceHash(before));
    // A stored embedding for the old text is therefore invalid for the new one.
    const stored = { ...before, ...documentMetadata(before, TEST_VECTOR) };
    expect(validStoredEmbedding(stored)).toBe(true);
    expect(validStoredEmbedding({ ...stored, ...after })).toBe(false);
  });

  test('10. no metadata or personal data leaks into the Voyage text', () => {
    const shape = submissionShape({
      ...SUPPLIED,
      email: 'student@example.invalid',
      matricNumber: 'PHS/22/0042',
      studentId: 7,
      sessionYear: '2025/2026',
      supervisorName: 'Dr X',
      expected_class: 'HIGH'
    });
    const text = serialize({ ...shape, email: 'student@example.invalid', matricNumber: 'PHS/22/0042', studentId: 7 });

    expect(text).toBe(EXPECTED_CANONICAL);
    for (const forbidden of ['malaria, prevention, mothers', 'Public Health', 'example.invalid', 'PHS/22/0042', '2025/2026', 'Dr X', 'HIGH']) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe('embedding roles and provider constants', () => {
  test('11. a submitted/new topic is embedded with input_type=query', async () => {
    const store = {};
    await embedQuery(precheckShape(SUPPLIED), { env: { VOYAGE_API_KEY: 'test' }, fetchImpl: fetchCapturing(store) });

    expect(store.payload).toEqual({ model: 'voyage-4-large', input: [EXPECTED_CANONICAL], input_type: 'query', output_dtype: 'float' });
  });

  test('12. a stored/searchable topic is embedded with input_type=document from the same text', async () => {
    const store = {};
    await embedDocument(submissionShape(SUPPLIED), { env: { VOYAGE_API_KEY: 'test' }, fetchImpl: fetchCapturing(store) });

    expect(store.payload).toEqual({ model: 'voyage-4-large', input: [EXPECTED_CANONICAL], input_type: 'document', output_dtype: 'float' });
  });

  test('13. thresholds are the frozen C1.5 constants', () => {
    expect(T1).toBe(0.5571529891797358);
    expect(T2).toBe(0.6450102471881145);
    expect(MODEL).toBe('voyage-4-large');
    expect(DIMENSION).toBe(1024);
    expect(REPRESENTATION_ID).toBe('structured-context-v1');
  });

  test('14. classification boundaries are unchanged', () => {
    expect(classify(T1 - Number.EPSILON)).toBe('LOW');
    expect(classify(T1)).toBe('MEDIUM');
    expect(classify(T2 - Number.EPSILON)).toBe('MEDIUM');
    expect(classify(T2)).toBe('HIGH');
    // Observed in the divergence probe under these exact constants.
    expect(classify(0.668709361742998)).toBe('HIGH');
    expect(classify(0.553996)).toBe('LOW');
  });

  test('15. no reverse (document) embedding of the submitted topic exists in the check path', () => {
    const controller = fs.readFileSync(path.join(__dirname, '../controllers/similarity.controller.js'), 'utf8');

    expect(controller).toMatch(/embedQuery/);
    expect(controller).not.toMatch(/embedDocument/);
  });

  test('16. no fallback vector exists anywhere in the provider layer', async () => {
    const provider = require('./voyageEmbedding.service');

    expect(Object.keys(provider).filter((key) => /fallback/i.test(key))).toEqual([]);
    expect(fs.readFileSync(path.join(__dirname, 'voyageEmbedding.service.js'), 'utf8')).not.toMatch(/fallback/i);
    await expect(embedQuery(precheckShape(SUPPLIED), {
      env: { VOYAGE_API_KEY: 'test' },
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) })
    })).rejects.toBeInstanceOf(VoyageProviderError);
  });
});

describe('17. corpus lifecycle carries the canonical fields', () => {
  test('a submission stores its context on both the submission row and the under-review corpus row', async () => {
    const prisma = minimalPrisma();
    const corpusLifecycle = lifecycleSpy();
    const service = createSubmissionService({ prismaClient: prisma, corpusLifecycle, notificationEvents: quietNotifications });

    await service.createSubmission({ user: { id: 7, role: 'student' }, input: SUPPLIED });

    expect(prisma.submission.create.mock.calls[0][0].data).toMatchObject({
      population: 'Mothers of children under five',
      location: 'Osogbo',
      studyFocus: 'Malaria prevention knowledge'
    });
    const underReview = prisma.underReviewTopic.create.mock.calls[0][0].data;
    expect(underReview).toMatchObject({ population: 'Mothers of children under five', location: 'Osogbo', studyFocus: 'Malaria prevention knowledge' });
    expect(underReview.embeddingSourceHash).toBe(sourceHash(precheckShape(SUPPLIED)));
    expect(validStoredEmbedding(underReview)).toBe(true);
  });

  test('approval of a legacy submission without an under-review row embeds from the persisted context', async () => {
    const submissionRow = {
      id: 21,
      studentId: 7,
      status: 'PENDING_REVIEW',
      title: SUPPLIED.title,
      category: SUPPLIED.category,
      keywords: SUPPLIED.keywords,
      population: SUPPLIED.population,
      location: SUPPLIED.location,
      studyFocus: SUPPLIED.studyFocus,
      session: { id: 3, name: '2025/2026' }
    };
    const prisma = minimalPrisma({
      submission: {
        findUnique: jest.fn().mockResolvedValue(submissionRow),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      }
    });
    const corpusLifecycle = lifecycleSpy();
    const service = createSubmissionService({ prismaClient: prisma, corpusLifecycle, notificationEvents: quietNotifications });

    await service.updateLecturerSubmissionStatus({ user: { id: 9, role: 'lecturer' }, submissionId: 21, status: 'approved' });

    const [regeneratedShape] = corpusLifecycle.prepareDocumentEmbedding.mock.calls[0];
    expect(serialize(regeneratedShape)).toBe(EXPECTED_CANONICAL);
    const promoted = prisma.currentSessionTopic.upsert.mock.calls[0][0].create;
    expect(promoted).toMatchObject({ population: 'Mothers of children under five', location: 'Osogbo', studyFocus: 'Malaria prevention knowledge' });
    expect(promoted.embeddingSourceHash).toBe(sourceHash(precheckShape(SUPPLIED)));
  });
});

describe('semantic context input validation', () => {
  test('mirrors the direct-check length ceiling so a pre-checked topic can always be submitted', () => {
    expect(MAX_SEMANTIC_CONTEXT_LENGTH).toBe(1000);
    expect(() => normalizeSemanticContext({ population: 'x'.repeat(1001) })).toThrow(/cannot exceed 1000/);
    expect(normalizeSemanticContext({ population: 'x'.repeat(1000) }).population).toHaveLength(1000);
  });

  test('rejects non-text context rather than coercing it into the semantic text', () => {
    expect(() => normalizeSemanticContext({ location: { city: 'Osogbo' } })).toThrow(/must be text/);
    expect(() => normalizeSemanticContext({ studyFocus: 42 })).toThrow(/must be text/);
  });

  test('accepts the snake_case study_focus alias used by the similarity API', () => {
    expect(normalizeSemanticContext({ study_focus: 'Awareness' }).studyFocus).toBe('Awareness');
  });
});
