const logger = require('../config/logger');
const { embedDocument, documentMetadata, validStoredEmbedding } = require('./voyageEmbedding.service');
const { residentCorpus } = require('./residentCorpus.service');

const RETRYABLE_VOYAGE_STATUSES = [429, 500, 502, 503];
const RATE_LIMIT_WAIT_MS = 61000;
const MAX_VOYAGE_ATTEMPTS = 3;

function defaultSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Same retry contract the embedding backfill CLI has always used: sequential calls,
// bounded retries on provider throttling/outage statuses, no fallback vectors.
async function retryVoyageCall(task, { sleepImpl = defaultSleep } = {}) {
  let error;
  for (let attempt = 0; attempt < MAX_VOYAGE_ATTEMPTS; attempt += 1) {
    try {
      return await task();
    } catch (caught) {
      error = caught;
      if (!RETRYABLE_VOYAGE_STATUSES.includes(caught.status) || attempt === MAX_VOYAGE_ATTEMPTS - 1) break;
      await sleepImpl(caught.status === 429 ? RATE_LIMIT_WAIT_MS : 1000 * (attempt + 1));
    }
  }
  throw error;
}

// Produces the exact stored-embedding metadata contract used everywhere else
// (provider/model/dimension/representation/source hash). Throws on provider
// failure or invalid vectors; never substitutes a fallback embedding.
async function prepareDocumentEmbedding(topic, { embedImpl = embedDocument, sleepImpl } = {}) {
  const embedding = await retryVoyageCall(() => embedImpl(topic), { sleepImpl });
  const metadata = documentMetadata(topic, embedding);
  if (!validStoredEmbedding({ ...topic, ...metadata })) {
    throw new Error('Generated embedding failed stored-embedding validation.');
  }
  return metadata;
}

// The semantic fields a student submission contributes to the corpus. Submissions
// capture no population/location/study focus; the frozen structured-context-v1
// representation treats those as optional.
function buildSubmissionTopicShape(submission) {
  return {
    title: submission.title,
    keywords: submission.keywords || null,
    category: submission.category || null,
    population: null,
    location: null,
    studyFocus: null
  };
}

async function refreshResidentCorpusSafely(context) {
  try {
    await residentCorpus.refresh();
    return true;
  } catch (error) {
    logger.warn(`Resident corpus refresh failed after ${context}: ${error.message}. The corpus self-refreshes on next read.`);
    return false;
  }
}

module.exports = {
  retryVoyageCall,
  prepareDocumentEmbedding,
  buildSubmissionTopicShape,
  refreshResidentCorpusSafely,
  RETRYABLE_VOYAGE_STATUSES,
  MAX_VOYAGE_ATTEMPTS
};
