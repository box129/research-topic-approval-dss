const { PrismaClient, Prisma } = require('@prisma/client');
const jaccardService = require('../services/jaccard.service');
const tfidfService = require('../services/tfidf.service');
const sbertService = require('../services/sbert.service');
const logger = require('../config/logger');
const {
  SIMILARITY_SCORING_CONTRACT,
  PRODUCTION_SCORING_CONTRACT,
  calculateWeightedCombinedScore,
  calculateFallbackCombinedScore,
  classifySimilarityRisk
} = require('../config/similarityScoring.config');

// Database query timeout in milliseconds
const DB_QUERY_TIMEOUT = 10000;

function toPercentageScore(score) {
  if (score === null || score === undefined) {
    return score;
  }
  const percentage = Math.round(score * 1000) / 10;
  return Math.max(0, Math.min(100, percentage));
}

function formatTierScoresForResponse(matches) {
  return matches.map(match => ({
    ...match,
    scores: {
      jaccard: toPercentageScore(match.scores.jaccard),
      tfidf: toPercentageScore(match.scores.tfidf),
      sbert: toPercentageScore(match.scores.sbert),
      combined: toPercentageScore(match.scores.combined)
    }
  }));
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatTimestamp(value) {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

function calculateMinutesAgo(value) {
  if (!value) {
    return null;
  }

  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
}

function buildRecommendation(overallRisk, tier3 = []) {
  if (overallRisk === 'HIGH') {
    const reviewingLecturer = tier3[0]?.reviewingLecturer;
    if (reviewingLecturer) {
      return `High similarity detected. Coordinate with ${reviewingLecturer} before proceeding to avoid duplicate approvals.`;
    }

    return 'High similarity detected. Request topic modification or check with colleagues.';
  }

  if (overallRisk === 'MEDIUM') {
    const reviewingLecturer = tier3[0]?.reviewingLecturer;
    if (reviewingLecturer) {
      return `Moderate similarity detected. Review flagged topics and coordinate with ${reviewingLecturer} before deciding.`;
    }

    return 'Moderate similarity detected. Review flagged topics before deciding.';
  }

  return 'Topic appears unique. Proceed with approval.';
}

function calculateMaxCombinedSimilarity(...tiers) {
  return tiers
    .flat()
    .reduce((maxScore, match) => Math.max(maxScore, match.scores?.combined || 0), 0);
}

function formatTier1ForFypContract(matches) {
  return matches.map(match => ({
    id: match.id,
    title: match.title,
    year: match.sessionYear,
    supervisor: match.supervisorName,
    category: match.category || null,
    jaccard: toPercentageScore(match.scores.jaccard),
    tfidf: toPercentageScore(match.scores.tfidf),
    sbert: toPercentageScore(match.scores.sbert),
    matched_keywords: match.matchedKeywords || []
  }));
}

function formatTier2ForFypContract(matches) {
  return matches.map(match => ({
    id: match.id,
    title: match.title,
    approved_date: formatTimestamp(match.approvedDate),
    supervisor: match.supervisorName,
    student_id: match.studentId || null,
    jaccard: toPercentageScore(match.scores.jaccard),
    tfidf: toPercentageScore(match.scores.tfidf),
    sbert: toPercentageScore(match.scores.sbert)
  }));
}

function formatTier3ForFypContract(matches) {
  return matches.map(match => ({
    id: match.id,
    title: match.title,
    reviewing_lecturer: match.reviewingLecturer || null,
    review_started_at: formatTimestamp(match.reviewStartedAt),
    minutes_ago: calculateMinutesAgo(match.reviewStartedAt),
    jaccard: toPercentageScore(match.scores.jaccard),
    tfidf: toPercentageScore(match.scores.tfidf),
    sbert: toPercentageScore(match.scores.sbert)
  }));
}

function withoutSbertScores(matches) {
  return matches.map(match => ({
    ...match,
    scores: {
      ...match.scores,
      sbert: null
    }
  }));
}

function buildFypSuccessResponse({ topic, overallRisk, overallMaxSimilarity, tier1, tier2, tier3 }) {
  return {
    status: 'success',
    data: {
      input_topic: topic,
      word_count: countWords(topic),
      char_count: topic.length,
      overall_risk: overallRisk,
      max_similarity: toPercentageScore(overallMaxSimilarity),
      tier1_historical: formatTier1ForFypContract(tier1),
      tier2_current: formatTier2ForFypContract(tier2),
      tier3_under_review: formatTier3ForFypContract(tier3),
      recommendation: buildRecommendation(overallRisk, tier3)
    }
  };
}

function buildFypPartialSuccessResponse({ topic, overallRisk, overallMaxSimilarity, tier1, tier2, tier3 }) {
  return {
    status: 'partial_success',
    message: 'SBERT semantic analysis unavailable. Showing lexical similarity only (Jaccard, TF-IDF).',
    data: {
      input_topic: topic,
      word_count: countWords(topic),
      char_count: topic.length,
      overall_risk: overallRisk,
      max_similarity: toPercentageScore(overallMaxSimilarity),
      tier1_historical: formatTier1ForFypContract(withoutSbertScores(tier1)),
      tier2_current: formatTier2ForFypContract(withoutSbertScores(tier2)),
      tier3_under_review: formatTier3ForFypContract(withoutSbertScores(tier3))
    }
  };
}

function buildValidationErrorResponse(message, field, errorCode) {
  return {
    status: 'error',
    message,
    details: {
      field,
      error_code: errorCode
    }
  };
}

// ============ Prisma Client Singleton ============
let prisma = null;
let prismaConnecting = false;

function getPrismaClient() {
  if (!prisma && !prismaConnecting) {
    prismaConnecting = true;
    try {
      prisma = new PrismaClient();
      logger.info('Prisma Client initialized successfully');
    } catch (err) {
      logger.error('Failed to initialize Prisma Client:', err);
      prismaConnecting = false;
      throw err;
    }
  }
  return prisma;
}

/**
 * Main controller for topic similarity checking
 * Combines Jaccard, TF-IDF, and SBERT algorithms to find similar topics
 */

/**
 * Helper function to add timeout to a promise
 * @param {Promise} promise - Promise to wrap with timeout
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of operation for error messages
 * @returns {Promise} Promise that rejects if timeout exceeded
 */
function withTimeout(promise, timeoutMs, operationName) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} exceeded ${timeoutMs}ms timeout`)),
        timeoutMs
      )
    )
  ]);
}

/**
 * Check similarity between a new topic and existing topics in the database
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.topic - Topic title to check
 * @param {string} [req.body.keywords] - Optional keywords for the topic
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @returns {Promise<void>} JSON response with similarity results
 */
async function checkSimilarity(req, res, next) {
  const startTime = Date.now();
  
  try {
    // 1. Extract and validate input
    const { topic, keywords } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json(
        buildValidationErrorResponse('Topic is required.', 'topic', 'MISSING_FIELD')
      );
    }

    const queryText = keywords ? `${topic} ${keywords}` : topic;
    logger.info(`Checking similarity for topic: "${topic.substring(0, 50)}..."`);

    // 2. Fetch all topics from 3 tables in parallel using Prisma with timeout
    logger.info('Fetching topics from database...');
    
    const dbClient = getPrismaClient();
    
    const [historicalTopics, currentSessionTopics, underReviewTopics] = await Promise.all([
      // Fetch all historical topics with embeddings
      withTimeout(
        dbClient.$queryRaw`
          SELECT 
            id, 
            title, 
            keywords,
            session_year,
            supervisor_name,
            category,
            embedding::text as embedding
          FROM historical_topics
          ORDER BY created_at DESC
        `,
        DB_QUERY_TIMEOUT,
        'Historical topics query'
      ),
      
      // Fetch all current session topics with embeddings
      withTimeout(
        dbClient.$queryRaw`
          SELECT 
            id, 
            title, 
            keywords,
            session_year,
            supervisor_name,
            category,
            approved_date,
            student_id,
            embedding::text as embedding
          FROM current_session_topics
          ORDER BY created_at DESC
        `,
        DB_QUERY_TIMEOUT,
        'Current session topics query'
      ),
      
      // Fetch under review topics from last 48 hours only
      withTimeout(
        dbClient.$queryRaw`
          SELECT 
            id, 
            title, 
            keywords,
            session_year,
            supervisor_name,
            category,
            embedding::text as embedding,
            review_started_at,
            reviewing_lecturer
          FROM under_review_topics
          WHERE review_started_at > NOW() - INTERVAL '48 hours'
          ORDER BY review_started_at DESC
        `,
        DB_QUERY_TIMEOUT,
        'Under review topics query'
      )
    ]);

    logger.info(`Fetched ${historicalTopics.length} historical, ${currentSessionTopics.length} current session, ${underReviewTopics.length} under review topics`);

    // 3. Parse pgvector embeddings (come as strings, need to parse to arrays)
    const parseEmbedding = (topic) => {
      if (topic.embedding) {
        try {
          topic.embedding = JSON.parse(topic.embedding);
        } catch (error) {
          logger.warn(`Failed to parse embedding for topic ${topic.id}: ${error.message}`);
          topic.embedding = null;
        }
      }
      return topic;
    };

    const parsedHistorical = historicalTopics.map(parseEmbedding);
    const parsedCurrentSession = currentSessionTopics.map(parseEmbedding);
    const parsedUnderReview = underReviewTopics.map(parseEmbedding);

    // Combine all topics for algorithm processing
    const allTopics = [
      ...parsedHistorical.map(t => ({ ...t, source: 'historical' })),
      ...parsedCurrentSession.map(t => ({ ...t, source: 'current_session' })),
      ...parsedUnderReview.map(t => ({ ...t, source: 'under_review' }))
    ];

    if (allTopics.length === 0) {
      logger.info('No topics found in database');
      return res.json(buildFypSuccessResponse({
        topic,
        overallRisk: 'LOW',
        overallMaxSimilarity: 0,
        tier1: [],
        tier2: [],
        tier3: []
      }));
    }

    // 4. Run 3 algorithms in parallel
    logger.info('Running similarity algorithms...');
    
    const algorithmResults = await Promise.allSettled([
      // Jaccard similarity
      Promise.resolve(jaccardService.calculateBatch(queryText, allTopics)),
      
      // TF-IDF similarity
      Promise.resolve(tfidfService.calculateTfIdfSimilarity(queryText, allTopics)),
      
      // SBERT similarity (with graceful degradation)
      sbertService.calculateSbertSimilarities(queryText, allTopics)
        .catch(error => {
          // Distinguish between timeout/service unavailable vs unexpected errors
          const isTimeoutError = error.message.includes('timeout') || 
                                error.message.includes('ECONNREFUSED') ||
                                error.code === 'ECONNREFUSED';
          
          const isRecoverableError = isTimeoutError || 
                                     error.message.includes('service unavailable');
          
          if (isRecoverableError) {
            logger.warn(`SBERT service unavailable, continuing without it: ${error.message}`);
            return null; // Graceful degradation for known issues
          } else {
            // Log unexpected errors with full context for debugging
            logger.error(`Unexpected SBERT error: ${error.message}`, {
              stack: error.stack,
              queryLength: queryText.length,
              topicCount: allTopics.length
            });
            return null; // Still degrade gracefully but know the reason
          }
        })
    ]);

    // Extract results
    const jaccardResults = algorithmResults[0].status === 'fulfilled' ? algorithmResults[0].value : [];
    const tfidfResults = algorithmResults[1].status === 'fulfilled' ? algorithmResults[1].value : [];
    const sbertResults = algorithmResults[2].status === 'fulfilled' ? algorithmResults[2].value : null;

    logger.info(`Algorithm results: Jaccard=${jaccardResults.length}, TF-IDF=${tfidfResults.length}, SBERT=${sbertResults ? sbertResults.length : 'N/A'}`);

    // 5. Combine results
    const combinedResults = combineAlgorithmResults(
      allTopics,
      jaccardResults,
      tfidfResults,
      sbertResults
    );

    // 6. Filter into 3 tiers
    const tier1Historical = filterTier1Historical(combinedResults, parsedHistorical);
    const hasSbertResults = sbertResults !== null;
    const tier2CurrentSession = filterTier2CurrentSession(combinedResults, parsedCurrentSession, hasSbertResults);
    const tier3UnderReview = filterTier3UnderReview(combinedResults, parsedUnderReview, hasSbertResults);

    logger.info(`Tiers: T1=${tier1Historical.length}, T2=${tier2CurrentSession.length}, T3=${tier3UnderReview.length}`);

    // 7. Calculate overall risk
    const overallMaxSimilarity = calculateMaxCombinedSimilarity(
      tier1Historical,
      tier2CurrentSession,
      tier3UnderReview
    );
    const overallRisk = classifySimilarityRisk(overallMaxSimilarity);

    // 8. Return JSON response
    const processingTime = Date.now() - startTime;
    logger.info(`Similarity check completed in ${processingTime}ms with risk level: ${overallRisk}`);

    if (sbertResults !== null) {
      return res.json(buildFypSuccessResponse({
        topic,
        overallRisk,
        overallMaxSimilarity,
        tier1: tier1Historical,
        tier2: tier2CurrentSession,
        tier3: tier3UnderReview
      }));
    }

    res.json(buildFypPartialSuccessResponse({
      topic,
      overallRisk,
      overallMaxSimilarity,
      tier1: tier1Historical,
      tier2: tier2CurrentSession,
      tier3: tier3UnderReview
    }));

  } catch (error) {
    logger.error(`Similarity check failed: ${error.message}`, { stack: error.stack });
    next(error);
  }
}

function compareCombinedResults(a, b) {
  const scoreDifference = (b.combinedScore ?? -Infinity) - (a.combinedScore ?? -Infinity);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const titleDifference = String(a.topic.title || '').localeCompare(String(b.topic.title || ''));
  if (titleDifference !== 0) {
    return titleDifference;
  }

  return Number(a.topic.id || 0) - Number(b.topic.id || 0);
}

function hasEligibleCombinedScore(result) {
  return Number.isFinite(result.combinedScore) &&
    result.combinedScore >= SIMILARITY_SCORING_CONTRACT.thresholds.tierMinimum;
}

/**
 * Combine results from multiple algorithms using the approved scoring contract.
 *
 * When SBERT is available, combined score is:
 *   jaccard * 0.20 + tfidf * 0.30 + sbert * 0.50
 * When SBERT is unavailable, fallback combined score is:
 *   jaccard * 0.40 + tfidf * 0.60
 *
 * @param {Array} allTopics - All topics from database
 * @param {Array} jaccardResults - Jaccard similarity results
 * @param {Array} tfidfResults - TF-IDF similarity results
 * @param {Array|null} sbertResults - SBERT similarity results (null if unavailable)
 * @returns {Array} Combined results ranked by approved combined score
 */
function combineAlgorithmResults(allTopics, jaccardResults, tfidfResults, sbertResults) {
  // Create a map of topic ID to combined scores
  const scoresMap = new Map();

  // Initialize with all topics
  allTopics.forEach(topic => {
    scoresMap.set(topic.id, {
      topic: topic,
      jaccard: 0,
      tfidf: 0,
      sbert: null,
      combinedScore: null,
      matchedKeywords: [],
      matchedTerms: []
    });
  });

  // Add Jaccard scores
  jaccardResults.forEach(result => {
    const entry = scoresMap.get(result.topicId);
    if (entry) {
      entry.jaccard = result.score;
      entry.matchedKeywords = result.matchedKeywords || [];
    }
  });

  // Add TF-IDF scores
  tfidfResults.forEach(result => {
    const entry = scoresMap.get(result.topicId);
    if (entry) {
      entry.tfidf = result.score;
      entry.matchedTerms = result.matchedTerms || [];
    }
  });

  // Add SBERT scores if available
  if (sbertResults) {
    sbertResults.forEach(result => {
      const entry = scoresMap.get(result.topicId);
      if (entry) {
        entry.sbert = result.score;
        entry.usedPrecomputed = result.usedPrecomputed;
      }
    });
  }

  const hasSbert = sbertResults !== null;
  const results = Array.from(scoresMap.values()).map(entry => {
    entry.combinedScore = hasSbert
      ? calculateWeightedCombinedScore(entry)
      : calculateFallbackCombinedScore(entry);
    return entry;
  });

  results.sort(compareCombinedResults);

  return results;
}

/**
 * Filter Tier 1: Top 5 historical topics
 * 
 * @param {Array} combinedResults - Combined algorithm results
 * @param {Array} historicalTopics - Historical topics from database
 * @returns {Array} Top 5 historical topics
 */
function filterTier1Historical(combinedResults, historicalTopics) {
  const historicalIds = new Set(historicalTopics.map(t => t.id));
  
  const tier1 = combinedResults
    .filter(result =>
      historicalIds.has(result.topic.id) &&
      hasEligibleCombinedScore(result)
    )
    .slice(0, 5)
    .map(result => ({
      id: result.topic.id,
      title: result.topic.title,
      keywords: result.topic.keywords,
      sessionYear: result.topic.session_year,
      supervisorName: result.topic.supervisor_name,
      category: result.topic.category,
      scores: {
        jaccard: result.jaccard,
        tfidf: result.tfidf,
        sbert: result.sbert,
        combined: result.combinedScore
      },
      matchedKeywords: result.matchedKeywords,
      matchedTerms: result.matchedTerms
    }));

  return tier1;
}

/**
 * Filter Tier 2: Current session topics with score >= threshold
 * 
 * @param {Array} combinedResults - Combined algorithm results
 * @param {Array} currentSessionTopics - Current session topics from database
 * @returns {Array} Current session topics with high similarity
 */
function meetsTierThreshold(result, hasSbertResults) {
  if (!hasSbertResults) {
    return false;
  }

  const { thresholds } = SIMILARITY_SCORING_CONTRACT;
  return hasEligibleCombinedScore(result) &&
    result.combinedScore >= thresholds.semanticTierCombinedMinimum &&
    result.sbert >= thresholds.semanticTierSbertMinimum;
}

function filterTier2CurrentSession(combinedResults, currentSessionTopics, hasSbertResults = true) {
  const currentSessionIds = new Set(currentSessionTopics.map(t => t.id));
  
  const tier2 = combinedResults
    .filter(result => 
      currentSessionIds.has(result.topic.id) && 
      meetsTierThreshold(result, hasSbertResults)
    )
    .map(result => ({
      id: result.topic.id,
      title: result.topic.title,
      keywords: result.topic.keywords,
      sessionYear: result.topic.session_year,
      supervisorName: result.topic.supervisor_name,
      category: result.topic.category,
      approvedDate: result.topic.approved_date,
      studentId: result.topic.student_id,
      scores: {
        jaccard: result.jaccard,
        tfidf: result.tfidf,
        sbert: result.sbert,
        combined: result.combinedScore
      },
      matchedKeywords: result.matchedKeywords,
      matchedTerms: result.matchedTerms
    }));

  return tier2;
}

/**
 * Filter Tier 3: Under review topics with score >= threshold
 * 
 * @param {Array} combinedResults - Combined algorithm results
 * @param {Array} underReviewTopics - Under review topics from database
 * @returns {Array} Under review topics with high similarity
 */
function filterTier3UnderReview(combinedResults, underReviewTopics, hasSbertResults = true) {
  const underReviewIds = new Set(underReviewTopics.map(t => t.id));
  
  const tier3 = combinedResults
    .filter(result => 
      underReviewIds.has(result.topic.id) && 
      meetsTierThreshold(result, hasSbertResults)
    )
    .map(result => ({
      id: result.topic.id,
      title: result.topic.title,
      keywords: result.topic.keywords,
      sessionYear: result.topic.session_year,
      supervisorName: result.topic.supervisor_name,
      category: result.topic.category,
      reviewingLecturer: result.topic.reviewing_lecturer,
      reviewStartedAt: result.topic.review_started_at,
      scores: {
        jaccard: result.jaccard,
        tfidf: result.tfidf,
        sbert: result.sbert,
        combined: result.combinedScore
      },
      matchedKeywords: result.matchedKeywords,
      matchedTerms: result.matchedTerms
    }));

  return tier3;
}

/**
 * Calculate overall risk level from the highest eligible approved combined score.
 *
 * @param {Array} tier1 - Tier 1 results
 * @param {Array} tier2 - Tier 2 results
 * @param {Array} tier3 - Tier 3 results
 * @returns {string} Risk level: 'LOW', 'MEDIUM', or 'HIGH'
 */
function calculateOverallRisk(tier1, tier2, tier3) {
  return classifySimilarityRisk(calculateMaxCombinedSimilarity(tier1, tier2, tier3));
}

module.exports = {
  checkSimilarity,
  PRODUCTION_SCORING_CONTRACT
};
