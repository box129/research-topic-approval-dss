const { calculateJaccard } = require('../src/services/jaccard.service');
const { calculateTfIdfSimilarity } = require('../src/services/tfidf.service');
const { formatStructuredContext, calculateSpearman } = require('./sbertInputRepresentation.helpers');

function titleOnly(topic) { return topic.title; }
function structuredLabelled(topic) { return formatStructuredContext(topic); }
function structuredValuesOnly(topic) { return [topic.title, topic.population, topic.location, topic.study_focus].filter(value => typeof value === 'string' && value.trim()).join('\n'); }
const REPRESENTATIONS = Object.freeze({ T: titleOnly, SL: structuredLabelled, SV: structuredValuesOnly });
function lexicalScores(cases) { return Object.fromEntries(Object.entries(REPRESENTATIONS).map(([name, serialize]) => [name, cases.map(item => ({ id:item.id, jaccard:calculateJaccard(serialize(item.submitted),serialize(item.existing)).score, tfidf:calculateTfIdfSimilarity(serialize(item.submitted),[{id:item.id,title:serialize(item.existing)}])[0].score }))])); }
function pearson(left,right){const n=left.length,ml=left.reduce((s,x)=>s+x,0)/n,mr=right.reduce((s,x)=>s+x,0)/n;let a=0,b=0,c=0;for(let i=0;i<n;i+=1){a+=(left[i]-ml)*(right[i]-mr);b+=(left[i]-ml)**2;c+=(right[i]-mr)**2;}return b&&c?a/Math.sqrt(b*c):0;}
function correlations(rows){const rank=(a,b)=>calculateSpearman(rows.map((r,i)=>({expected_class:['LOW','MEDIUM','HIGH'][i%3],scores:{x:r[a],y:r[b]}})),'x').coefficient; // rank helper below avoids labels
  const spearman=(a,b)=>{const values=rows.map(r=>r[a]), other=rows.map(r=>r[b]); const ranks=v=>v.map((x,i)=>1+v.filter(y=>y<x).length+(v.filter(y=>y===x).length-1)/2); return pearson(ranks(values),ranks(other));}; return { jaccardSemantic:{spearman:spearman('jaccard','semantic'),pearson:pearson(rows.map(r=>r.jaccard),rows.map(r=>r.semantic))}, tfidfSemantic:{spearman:spearman('tfidf','semantic'),pearson:pearson(rows.map(r=>r.tfidf),rows.map(r=>r.semantic))}, jaccardTfidf:{spearman:spearman('jaccard','tfidf'),pearson:pearson(rows.map(r=>r.jaccard),rows.map(r=>r.tfidf))} }; }
module.exports={REPRESENTATIONS,titleOnly,structuredLabelled,structuredValuesOnly,lexicalScores,correlations};
