/**
 * Real-PostgreSQL concurrency coverage for the lecturer decision transition.
 *
 * A pending submission must move to exactly ONE terminal lecturer decision.
 * The database arbitrates the winner (a compare-and-set on the pending status
 * inside the decision transaction); every concurrent or repeated terminal
 * decision must fail with the existing SUBMISSION_NOT_PENDING contract and
 * must leave no trace: no status/rationale change, no corpus lifecycle write,
 * no contradictory notification, no successful response.
 *
 * Runs against DATABASE_URL (the CI PostgreSQL service, or a scratch database
 * locally). Voyage is mocked; approvals reuse the valid stored under-review
 * vector, so no document embedding is requested during a race.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const config = require('../../src/config/env');

jest.mock('../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), http: jest.fn() }));
jest.mock('../../src/services/voyageEmbedding.service', () => {
  const actual = jest.requireActual('../../src/services/voyageEmbedding.service');
  return { ...actual, embedQuery: jest.fn(), embedDocument: jest.fn() };
});

const app = require('../../src/server');
const voyage = require('../../src/services/voyageEmbedding.service');
const { createSubmissionService } = require('../../src/services/submission.service');
const { buildSubmissionTopicShape } = require('../../src/services/topicCorpusLifecycle.service');
const { ResidentCorpus } = require('../../src/services/residentCorpus.service');

jest.setTimeout(240000);

const prisma = new PrismaClient();
const DOCUMENT_VECTOR = Array.from({ length: 1024 }, (_, index) => (index % 7 === 0 ? 0.5 : 0.1));
const REASON = 'Rejected in the concurrency test: the proposal duplicates an approved study in scope and design.';
const silentLog = { info() {}, warn() {}, error() {} };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const runTag = `${process.pid}-${Date.now()}`;

const created = { users: [], submissions: [] };
let student;
let lecturerA;
let lecturerB;
let service;
let cookieA;
let cookieB;

function sessionCookie(user, role) {
  const token = jwt.sign({ sub: String(user.id), role, cv: user.credentialVersion }, config.auth.jwtSecret, { expiresIn: '1h' });
  return `${config.auth.cookieName}=${token}`;
}

async function createUser({ role, name, email = null, matricNumber = null }) {
  const user = await prisma.user.create({
    data: { name, email, matricNumber, role, status: 'ACTIVE', passwordHash: 'not-used-by-token-authentication', mustChangePassword: false, credentialVersion: 1 }
  });
  created.users.push(user.id);
  return user;
}

// A pending submission with a valid current-contract under-review vector — the
// state a lecturer decides on. Created directly so no Voyage call is needed.
async function createPendingSubmission(index) {
  const shape = buildSubmissionTopicShape({
    title: `Concurrency topic ${runTag}-${index} on household water treatment practices in rural communities`,
    keywords: 'water, treatment',
    category: 'Environmental Health',
    population: 'Rural households',
    location: 'Ede',
    studyFocus: 'Water treatment practices'
  });
  const submission = await prisma.$transaction(async (tx) => {
    const row = await tx.submission.create({
      data: { studentId: student.id, title: shape.title, category: shape.category, keywords: shape.keywords, population: shape.population, location: shape.location, studyFocus: shape.studyFocus, status: 'PENDING_REVIEW' }
    });
    await tx.underReviewTopic.create({
      data: { ...shape, keywords: shape.keywords || '', sessionYear: '', supervisorName: '', sourceType: 'submission', reviewStartedAt: row.submittedAt, submissionId: row.id, ...voyage.documentMetadata(shape, DOCUMENT_VECTOR) }
    });
    return row;
  });
  created.submissions.push(submission.id);
  return submission;
}

const approveVia = {
  service: (lecturer, id) => service.updateLecturerSubmissionStatus({ user: { id: lecturer.id, role: 'lecturer' }, submissionId: id, status: 'approved' }),
  http: (cookie, id) => request(app).patch(`/api/v1/lecturer/submissions/${id}/status`).set('Cookie', cookie).send({ status: 'approved' })
};
const rejectVia = {
  service: (lecturer, id) => service.updateLecturerSubmissionStatus({ user: { id: lecturer.id, role: 'lecturer' }, submissionId: id, status: 'rejected', reason: REASON }),
  http: (cookie, id) => request(app).patch(`/api/v1/lecturer/submissions/${id}/status`).set('Cookie', cookie).send({ status: 'rejected', reason: REASON })
};

// Outcome of one service call: 'ok' or the SubmissionServiceError code.
async function outcomeOf(promise) {
  try { await promise; return { ok: true }; } catch (error) { return { ok: false, statusCode: error.statusCode, code: error.code, message: error.message, name: error.name }; }
}

async function inspect(submissionId, since) {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  const currentRows = await prisma.currentSessionTopic.count({ where: { submissionId } });
  const reviewRows = await prisma.underReviewTopic.count({ where: { submissionId } });
  const notifications = await prisma.notification.findMany({ where: { userId: student.id, createdAt: { gte: since } }, select: { title: true, type: true } });
  const corpus = new ResidentCorpus(prisma, silentLog);
  const snapshots = [];
  for (let refresh = 0; refresh < 2; refresh += 1) {
    const snapshot = await corpus.refresh();
    const hits = corpus.searchable(snapshot).filter((topic) => topic.submissionId === submissionId).map((topic) => topic.collection);
    snapshots.push(hits);
  }
  return { submission, currentRows, reviewRows, notifications, snapshots };
}

// The invariant every race must satisfy: terminal status == lifecycle state ==
// searchable corpus state, one rationale, one notification, on every refresh.
function assertConsistent(state, { winner, winnerReason, winnerTitle }) {
  const { submission, currentRows, reviewRows, notifications, snapshots } = state;
  expect(['APPROVED', 'REJECTED', 'AWAITING_REVISION']).toContain(submission.status);
  expect(submission.decidedById).toBe(winner.id);
  expect(submission.decisionReason).toBe(winnerReason);
  expect(reviewRows).toBe(0);
  if (submission.status === 'APPROVED') {
    expect(currentRows).toBe(1);
    for (const hits of snapshots) expect(hits).toEqual(['CURRENT_SESSION']);
  } else {
    expect(currentRows).toBe(0);
    for (const hits of snapshots) expect(hits).toEqual([]);
  }
  expect(notifications).toHaveLength(1);
  expect(notifications[0].title).toBe(winnerTitle);
}

beforeAll(async () => {
  student = await createUser({ role: 'STUDENT', name: 'Concurrency Student', matricNumber: `CON/26/${String(Date.now() % 10000).padStart(4, '0')}` });
  lecturerA = await createUser({ role: 'LECTURER', name: 'Concurrency Lecturer A', email: `concurrency-a-${runTag}@example.test` });
  lecturerB = await createUser({ role: 'LECTURER', name: 'Concurrency Lecturer B', email: `concurrency-b-${runTag}@example.test` });
  service = createSubmissionService({ prismaClient: prisma });
  // A losing APPROVE can read the under-review row after the winning REJECT has
  // already deleted it; it then regenerates a document embedding before its
  // transaction discovers the lost race. The provider is mocked so that path
  // completes and reaches the compare-and-set (one avoidable provider call in
  // that window is a known, harmless cost — it never writes anything).
  voyage.embedDocument.mockResolvedValue(DOCUMENT_VECTOR);
  cookieA = sessionCookie(lecturerA, 'lecturer');
  cookieB = sessionCookie(lecturerB, 'lecturer');
});

afterAll(async () => {
  const ids = created.submissions;
  await prisma.underReviewTopic.deleteMany({ where: { submissionId: { in: ids } } });
  await prisma.currentSessionTopic.deleteMany({ where: { submissionId: { in: ids } } });
  await prisma.similarityCheckSnapshot.deleteMany({ where: { submissionId: { in: ids } } });
  await prisma.submission.deleteMany({ where: { id: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: { in: created.users } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: created.users } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.$disconnect();
});

describe('lecturer decision transition is atomic (real PostgreSQL)', () => {
  test('a normal single decision behaves as before: approve promotes, reject records the rationale', async () => {
    const approved = await createPendingSubmission('single-approve');
    const sinceA = new Date();
    await approveVia.service(lecturerA, approved.id);
    assertConsistent(await inspect(approved.id, sinceA), { winner: lecturerA, winnerReason: null, winnerTitle: 'Topic approved' });

    const rejected = await createPendingSubmission('single-reject');
    const sinceB = new Date();
    await rejectVia.service(lecturerB, rejected.id);
    assertConsistent(await inspect(rejected.id, sinceB), { winner: lecturerB, winnerReason: REASON, winnerTitle: 'Topic rejected' });
    expect(voyage.embedDocument).not.toHaveBeenCalled();
  });

  test('A. service-level APPROVE vs REJECT: exactly one wins in every scheduling order (50 races)', async () => {
    const staggers = [0, 0, 2, 5, 10, 15, 25];
    const tally = { approveWon: 0, rejectWon: 0, doubleSuccess: 0, inconsistent: 0 };
    for (let iteration = 0; iteration < 50; iteration += 1) {
      const submission = await createPendingSubmission(`A-${iteration}`);
      const since = new Date();
      const approveFirst = iteration % 2 === 0;
      const stagger = staggers[iteration % staggers.length];
      const first = approveFirst ? () => approveVia.service(lecturerA, submission.id) : () => rejectVia.service(lecturerB, submission.id);
      const second = approveFirst ? () => rejectVia.service(lecturerB, submission.id) : () => approveVia.service(lecturerA, submission.id);
      const p1 = outcomeOf(first());
      if (stagger) await sleep(stagger);
      const p2 = outcomeOf(second());
      const results = await Promise.all([p1, p2]);
      const successes = results.filter((r) => r.ok);
      const conflicts = results.filter((r) => !r.ok);
      if (successes.length === 2) tally.doubleSuccess += 1;
      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({ statusCode: 400, code: 'SUBMISSION_NOT_PENDING', message: 'Only pending review submissions can be updated.' });

      const state = await inspect(submission.id, since);
      const approveWon = state.submission.status === 'APPROVED';
      if (approveWon) tally.approveWon += 1; else tally.rejectWon += 1;
      try {
        assertConsistent(state, approveWon
          ? { winner: lecturerA, winnerReason: null, winnerTitle: 'Topic approved' }
          : { winner: lecturerB, winnerReason: REASON, winnerTitle: 'Topic rejected' });
      } catch (error) { tally.inconsistent += 1; throw error; }
    }
    expect(tally.doubleSuccess).toBe(0);
    expect(tally.inconsistent).toBe(0);
    // Scheduling variation must have produced both winners, or the race was not real.
    expect(tally.approveWon).toBeGreaterThan(0);
    expect(tally.rejectWon).toBeGreaterThan(0);
    // Provider calls can only come from a losing approve in the window above;
    // they are bounded by the number of races and never produce a write.
    expect(voyage.embedDocument.mock.calls.length).toBeLessThanOrEqual(50);
  });

  test('B. HTTP/controller-level APPROVE vs REJECT: one 200, one 400, consistent state (24 races)', async () => {
    const tally = { approveWon: 0, rejectWon: 0 };
    for (let iteration = 0; iteration < 24; iteration += 1) {
      const submission = await createPendingSubmission(`B-${iteration}`);
      const since = new Date();
      const approveFirst = iteration % 2 === 0;
      const stagger = [0, 3, 8, 15][iteration % 4];
      // supertest starts a request when it is awaited/then()-ed; start the first one explicitly.
      const first = (approveFirst ? approveVia.http(cookieA, submission.id) : rejectVia.http(cookieB, submission.id)).then((res) => res);
      if (stagger) await sleep(stagger);
      const second = approveFirst ? rejectVia.http(cookieB, submission.id) : approveVia.http(cookieA, submission.id);
      const [r1, r2] = await Promise.all([first, second]);
      const statuses = [r1.status, r2.status].sort();
      expect({ statuses, bodies: [r1.body, r2.body] }).toMatchObject({ statuses: [200, 400] });
      const conflict = r1.status === 400 ? r1 : r2;
      expect(conflict.body).toMatchObject({ status: 'error', details: { error_code: 'SUBMISSION_NOT_PENDING' } });
      expect(JSON.stringify(conflict.body)).not.toMatch(/prisma|transaction|updateMany|sql/i);

      const state = await inspect(submission.id, since);
      const approveWon = state.submission.status === 'APPROVED';
      if (approveWon) tally.approveWon += 1; else tally.rejectWon += 1;
      assertConsistent(state, approveWon
        ? { winner: lecturerA, winnerReason: null, winnerTitle: 'Topic approved' }
        : { winner: lecturerB, winnerReason: REASON, winnerTitle: 'Topic rejected' });
    }
    expect(tally.approveWon + tally.rejectWon).toBe(24);
  });

  test('C. APPROVE vs APPROVE: one approval, one conflict, exactly one current-session row', async () => {
    for (let iteration = 0; iteration < 10; iteration += 1) {
      const submission = await createPendingSubmission(`C-${iteration}`);
      const since = new Date();
      const results = await Promise.all([outcomeOf(approveVia.service(lecturerA, submission.id)), outcomeOf(approveVia.service(lecturerB, submission.id))]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok)[0]).toMatchObject({ statusCode: 400, code: 'SUBMISSION_NOT_PENDING' });
      const state = await inspect(submission.id, since);
      const winner = state.submission.decidedById === lecturerA.id ? lecturerA : lecturerB;
      expect(state.submission.status).toBe('APPROVED');
      assertConsistent(state, { winner, winnerReason: null, winnerTitle: 'Topic approved' });
    }
  });

  test('D. REJECT vs REJECT: one rejection, one conflict, no corpus row', async () => {
    for (let iteration = 0; iteration < 10; iteration += 1) {
      const submission = await createPendingSubmission(`D-${iteration}`);
      const since = new Date();
      const results = await Promise.all([outcomeOf(rejectVia.service(lecturerA, submission.id)), outcomeOf(rejectVia.service(lecturerB, submission.id))]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok)[0]).toMatchObject({ statusCode: 400, code: 'SUBMISSION_NOT_PENDING' });
      const state = await inspect(submission.id, since);
      const winner = state.submission.decidedById === lecturerA.id ? lecturerA : lecturerB;
      expect(state.submission.status).toBe('REJECTED');
      assertConsistent(state, { winner, winnerReason: REASON, winnerTitle: 'Topic rejected' });
    }
  });

  test('E. a terminal decision followed by a retry of the same decision: the retry conflicts and changes nothing', async () => {
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const submission = await createPendingSubmission(`E-${iteration}`);
      const since = new Date();
      await approveVia.service(lecturerA, submission.id);
      const decided = await prisma.submission.findUnique({ where: { id: submission.id } });
      // sequential retry (network retry after a lost response)
      await expect(approveVia.service(lecturerA, submission.id)).rejects.toMatchObject({ statusCode: 400, code: 'SUBMISSION_NOT_PENDING' });
      // concurrent identical retries
      const results = await Promise.all([outcomeOf(approveVia.service(lecturerA, submission.id)), outcomeOf(approveVia.service(lecturerA, submission.id))]);
      expect(results.filter((r) => r.ok)).toHaveLength(0);
      const state = await inspect(submission.id, since);
      expect(state.submission.decidedAt.toISOString()).toBe(decided.decidedAt.toISOString());
      assertConsistent(state, { winner: lecturerA, winnerReason: null, winnerTitle: 'Topic approved' });
    }
  });
});
