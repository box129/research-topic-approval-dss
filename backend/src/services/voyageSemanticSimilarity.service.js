const { validStoredEmbedding } = require('./voyageEmbedding.service');
// C1.5 submitted-query -> existing-document production-direction thresholds.
const T1 = 0.5571529891797358; const T2 = 0.6450102471881145;
function cosine(a, b) { if (!Array.isArray(a) || a.length !== b.length) throw new Error('Equal-length vectors required.'); let dot=0, aa=0, bb=0; for(let i=0;i<a.length;i+=1){dot+=a[i]*b[i];aa+=a[i]**2;bb+=b[i]**2;} if(!aa||!bb) throw new Error('Zero vector is invalid.'); return dot / Math.sqrt(aa * bb); }
function classify(score) { return score < T1 ? 'LOW' : score < T2 ? 'MEDIUM' : 'HIGH'; }
function retrieve(query, topics, topK = 5) { return topics.filter(validStoredEmbedding).map(topic => ({ topic, score: cosine(query, topic.embedding) })).sort((a,b) => b.score - a.score).slice(0, topK); }
module.exports = { T1, T2, cosine, classify, retrieve };
