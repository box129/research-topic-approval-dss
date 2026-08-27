const { embedQuery, VoyageProviderError } = require('../services/voyageEmbedding.service');
const { retrieve, classify } = require('../services/voyageSemanticSimilarity.service');
const { residentCorpus } = require('../services/residentCorpus.service');
const logger = require('../config/logger');
const MAX_SIMILARITY_FIELD_LENGTH = 1000;
// The resident corpus loads whole table rows, so a match object also carries the
// embedding vector, its source hash and provider metadata, import provenance,
// and — on current-session topics — a student id. Serialisation is therefore an
// explicit allowlist of fields that are safe and useful to whoever is reading
// the evidence, never a spread of the row. Nothing below is derived from the
// embedding, and adding these fields does not change how similarity is scored,
// ranked or classified.
const SAFE_MATCH_CONTEXT = [
  ['session_year', 'sessionYear'],
  ['supervisor_name', 'supervisorName'],
  ['population', 'population'],
  ['location', 'location'],
  ['study_focus', 'studyFocus']
];

// Corpus rows use '' for "not recorded" as often as null (submission-sourced
// under-review rows store an empty supervisor name, for example). Both collapse
// to null so the UI has exactly one absent case to skip, and never renders an
// empty label or the string "null".
function contextValue(value) {
  const normalized = typeof value === 'string' ? value.trim() : value;
  return normalized || null;
}

function responseMatch(item) {
  const topic = item.topic;

  return {
    id: topic.id,
    title: topic.title,
    category: contextValue(topic.category),
    collection: topic.collection,
    ...Object.fromEntries(SAFE_MATCH_CONTEXT.map(([exposed, source]) => [exposed, contextValue(topic[source])])),
    semantic_score: item.score,
    similarity_class: classify(item.score)
  };
}
async function checkSimilarity(req, res, next) {
  try {
    const { topic: title, population, location, studyFocus } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) return res.status(400).json({ status:'error', message:'Topic is required.', details:{field:'topic',error_code:'MISSING_FIELD'} });
    const oversizedField = Object.entries({ topic: title, population, location, studyFocus })
      .find(([, value]) => typeof value === 'string' && value.length > MAX_SIMILARITY_FIELD_LENGTH)?.[0];
    if (oversizedField) {
      return res.status(400).json({
        status: 'error',
        message: 'Similarity input is too long.',
        details: {
          field: oversizedField,
          error_code: 'SIMILARITY_INPUT_TOO_LARGE'
        }
      });
    }
    const searchable = residentCorpus.searchable(await residentCorpus.get());
    // An empty comparison corpus is reported truthfully: it is not evidence that
    // the proposed topic is new or original, so no risk class is asserted.
    if (!searchable.length) {
      return res.json({ status:'success', semanticAvailable:true, semanticProvider:'voyage', semanticModel:'voyage-4-large', data:{ input_topic:title, corpus_size:0, overall_risk:null, max_similarity:null, matches:[], recommendation:'No eligible stored topics are currently available for comparison. This result does not establish that the topic is new or original.' } });
    }
    let query;
    try { query = await embedQuery({ title, population, location, studyFocus }); }
    catch (error) { if (error instanceof VoyageProviderError) return res.status(503).json({ status:'semantic_unavailable', message:'Semantic analysis is currently unavailable.', semanticAvailable:false, semanticProvider:'voyage', semanticModel:'voyage-4-large' }); throw error; }
    const matches=retrieve(query,searchable,5);
    const top=matches[0]?.score ?? 0;
    return res.json({ status:'success', semanticAvailable:true, semanticProvider:'voyage', semanticModel:'voyage-4-large', data:{ input_topic:title, corpus_size:searchable.length, overall_risk:classify(top), max_similarity:top, matches:matches.map(responseMatch), recommendation:'Similarity classification is advisory; final academic judgement remains human.' } });
  } catch (error) { logger.error(`Voyage semantic check failed: ${error.message}`); return next(error); }
}
module.exports={checkSimilarity};
