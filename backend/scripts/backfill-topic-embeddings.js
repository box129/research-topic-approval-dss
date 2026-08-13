const prisma = require('../src/config/database');
const { embedDocument, validStoredEmbedding, documentMetadata } = require('../src/services/voyageEmbedding.service');
const MODELS = ['historicalTopic', 'currentSessionTopic', 'underReviewTopic'];
async function retry(task) { let error; for(let attempt=0;attempt<3;attempt+=1){try{return await task();}catch(caught){error=caught;if(![429,500,502,503].includes(caught.status)||attempt===2)break;await new Promise(resolve=>setTimeout(resolve,caught.status===429?61000:1000*(attempt+1)));}}throw error; }
async function main() { const report={completed:0,skipped:0,failed:0}; for(const model of MODELS){for(const topic of await prisma[model].findMany()){if(validStoredEmbedding(topic)){report.skipped+=1;continue;}try{const embedding=await retry(()=>embedDocument(topic));await prisma[model].update({where:{id:topic.id},data:documentMetadata(topic,embedding)});report.completed+=1;}catch(_){report.failed+=1;}}} console.log(JSON.stringify(report)); }
if(require.main===module) main().catch(error=>{console.error(error.message);process.exitCode=1;}); module.exports={main,retry};
