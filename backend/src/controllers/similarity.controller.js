const { PrismaClient } = require('@prisma/client');
const { embedQuery, VoyageProviderError } = require('../services/voyageEmbedding.service');
const { retrieve, classify } = require('../services/voyageSemanticSimilarity.service');
const logger = require('../config/logger');
let prisma;
function db() { if (!prisma) prisma = new PrismaClient(); return prisma; }
function topic(row, collection) { return { ...row, collection, studyFocus: row.studyFocus ?? row.study_focus }; }
function responseMatch(item) { return { id:item.topic.id, title:item.topic.title, category:item.topic.category || null, collection:item.topic.collection, semantic_score:item.score, similarity_class:classify(item.score) }; }
async function checkSimilarity(req, res, next) {
  try {
    const { topic: title, population, location, studyFocus } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) return res.status(400).json({ status:'error', message:'Topic is required.', details:{field:'topic',error_code:'MISSING_FIELD'} });
    let query;
    try { query = await embedQuery({ title, population, location, studyFocus }); }
    catch (error) { if (error instanceof VoyageProviderError) return res.status(503).json({ status:'semantic_unavailable', message:'Semantic analysis is currently unavailable.', semanticAvailable:false, semanticProvider:'voyage', semanticModel:'voyage-4-large' }); throw error; }
    const client = db();
    const [historical, current, review] = await Promise.all([
      client.historicalTopic.findMany(),
      client.currentSessionTopic.findMany(),
      client.underReviewTopic.findMany({ where: { reviewStartedAt: { gt: new Date(Date.now() - 48 * 3600000) } } })
    ]);
    const matches=retrieve(query,[...historical.map(x=>topic(x,'HISTORICAL')),...current.map(x=>topic(x,'CURRENT_SESSION')),...review.map(x=>topic(x,'UNDER_REVIEW'))],5);
    const top=matches[0]?.score ?? 0;
    return res.json({ status:'success', semanticAvailable:true, semanticProvider:'voyage', semanticModel:'voyage-4-large', data:{ input_topic:title, overall_risk:classify(top), max_similarity:top, matches:matches.map(responseMatch), recommendation:'Similarity classification is advisory; final academic judgement remains human.' } });
  } catch (error) { logger.error(`Voyage semantic check failed: ${error.message}`); return next(error); }
}
module.exports={checkSimilarity};
