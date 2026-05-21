const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const IMPORT_BATCH_ID = 'demo-comparison-topics-v1';
const SOURCE_TYPE = 'demo';
const SOURCE_FILENAME = 'demo-comparison-topics.json';
const fixturePath = path.join(__dirname, SOURCE_FILENAME);

function readFixture() {
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

function withDemoMetadata(row) {
  return {
    ...row,
    sourceType: SOURCE_TYPE,
    sourceFilename: SOURCE_FILENAME,
    importBatchId: IMPORT_BATCH_ID,
    embedding: null
  };
}

function mapHistoricalTopic(row) {
  return withDemoMetadata({
    title: row.title,
    keywords: row.keywords || null,
    sessionYear: row.sessionYear,
    supervisorName: row.supervisorName,
    category: row.category || null,
    population: row.population || null,
    location: row.location || null,
    studyFocus: row.studyFocus || null
  });
}

function mapCurrentSessionTopic(row) {
  return withDemoMetadata({
    title: row.title,
    keywords: row.keywords || null,
    sessionYear: row.sessionYear,
    supervisorName: row.supervisorName,
    category: row.category || null,
    population: row.population || null,
    location: row.location || null,
    studyFocus: row.studyFocus || null,
    approvedDate: row.approvedDate ? new Date(row.approvedDate) : null,
    studentId: row.studentId || null
  });
}

function mapUnderReviewTopic(row) {
  const hoursAgo = Number(row.reviewStartedAtHoursAgo || 1);

  return withDemoMetadata({
    title: row.title,
    keywords: row.keywords || null,
    sessionYear: row.sessionYear,
    supervisorName: row.supervisorName,
    category: row.category || null,
    population: row.population || null,
    location: row.location || null,
    studyFocus: row.studyFocus || null,
    reviewStartedAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
    reviewingLecturer: row.reviewingLecturer || null
  });
}

async function deleteExistingDemoRows() {
  const [historical, currentSession, underReview] = await prisma.$transaction([
    prisma.historicalTopic.deleteMany({
      where: { importBatchId: IMPORT_BATCH_ID }
    }),
    prisma.currentSessionTopic.deleteMany({
      where: { importBatchId: IMPORT_BATCH_ID }
    }),
    prisma.underReviewTopic.deleteMany({
      where: { importBatchId: IMPORT_BATCH_ID }
    })
  ]);

  return {
    historical: historical.count,
    currentSession: currentSession.count,
    underReview: underReview.count
  };
}

async function insertDemoRows(fixture) {
  const historicalRows = (fixture.historical || []).map(mapHistoricalTopic);
  const currentSessionRows = (fixture.currentSession || []).map(mapCurrentSessionTopic);
  const underReviewRows = (fixture.underReview || []).map(mapUnderReviewTopic);

  const [historical, currentSession, underReview] = await prisma.$transaction([
    prisma.historicalTopic.createMany({ data: historicalRows }),
    prisma.currentSessionTopic.createMany({ data: currentSessionRows }),
    prisma.underReviewTopic.createMany({ data: underReviewRows })
  ]);

  return {
    historical: historical.count,
    currentSession: currentSession.count,
    underReview: underReview.count
  };
}

async function countDemoRows() {
  const [historical, currentSession, underReview] = await Promise.all([
    prisma.historicalTopic.count({ where: { importBatchId: IMPORT_BATCH_ID } }),
    prisma.currentSessionTopic.count({ where: { importBatchId: IMPORT_BATCH_ID } }),
    prisma.underReviewTopic.count({ where: { importBatchId: IMPORT_BATCH_ID } })
  ]);

  return { historical, currentSession, underReview };
}

async function main() {
  const fixture = readFixture();

  console.log('Seeding local demo comparison topics.');
  console.log(`Demo importBatchId: ${IMPORT_BATCH_ID}`);
  console.log('Only rows with this importBatchId will be replaced.');

  const deleted = await deleteExistingDemoRows();
  console.log('Deleted existing demo rows:');
  console.log(JSON.stringify(deleted, null, 2));

  const inserted = await insertDemoRows(fixture);
  console.log('Inserted demo rows:');
  console.log(JSON.stringify(inserted, null, 2));

  const counts = await countDemoRows();
  console.log('Current demo row counts:');
  console.log(JSON.stringify(counts, null, 2));
  console.log('Demo comparison topic seeding complete.');
}

main()
  .catch((error) => {
    console.error('Failed to seed demo comparison topics.');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
