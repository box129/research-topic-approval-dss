// Legacy-repair CLI: backfills valid Voyage embeddings onto rows that predate the
// lifecycle/import embedding guarantees. Normal operation no longer requires it —
// imports and submission/decision lifecycles persist valid embeddings themselves.
const prisma = require('../src/config/database');
const { embedDocument, validStoredEmbedding, documentMetadata } = require('../src/services/voyageEmbedding.service');
const { retryVoyageCall } = require('../src/services/topicCorpusLifecycle.service');
const MODELS = ['historicalTopic', 'currentSessionTopic', 'underReviewTopic'];
async function main() { const report={completed:0,skipped:0,failed:0}; for(const model of MODELS){for(const topic of await prisma[model].findMany()){if(validStoredEmbedding(topic)){report.skipped+=1;continue;}try{const embedding=await retryVoyageCall(()=>embedDocument(topic));await prisma[model].update({where:{id:topic.id},data:documentMetadata(topic,embedding)});report.completed+=1;}catch(_){report.failed+=1;}}} console.log(JSON.stringify(report)); }
if(require.main===module) main().catch(error=>{console.error(error.message);process.exitCode=1;}); module.exports={main,retry:retryVoyageCall};
