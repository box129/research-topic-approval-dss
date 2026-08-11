const { calculateJaccard } = require('../src/services/jaccard.service');
const { calculateTfIdfSimilarity } = require('../src/services/tfidf.service');
const { calculateClassStatistics, calculateSpearman, calculateConcordance, calculateClassMargins } = require('./sbertInputRepresentation.helpers');
const { groupedCrossValidate, componentBootstrap } = require('./groupedCrossValidation.helpers');

const round = value => Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : null;
const CLASSES = ['LOW', 'MEDIUM', 'HIGH'];
const CURRENT_WEIGHTS = Object.freeze({ jaccard: .20, tfidf: .30, semantic: .50 });
const ABLATIONS = Object.freeze({ jaccard: { jaccard: 1 }, tfidf: { tfidf: 1 }, semantic: { semantic: 1 }, lexical: { jaccard: .40, tfidf: .60 }, jaccard_semantic: { jaccard: .2857142857, semantic: .7142857143 }, tfidf_semantic: { tfidf: .375, semantic: .625 }, full: CURRENT_WEIGHTS });

function titleOnlyLexical(cases) { return cases.map(item => ({ id: item.id, jaccard: calculateJaccard(item.submitted.title, item.existing.title).score, tfidf: calculateTfIdfSimilarity(item.submitted.title, [{ id: item.id, title: item.existing.title }])[0].score })); }
function scoreFor(weights, lexical, semantic) { return round((weights.jaccard || 0) * lexical.jaccard + (weights.tfidf || 0) * lexical.tfidf + (weights.semantic || 0) * semantic); }
function records(cases, lexicalById, semanticById, key, weights) {
  return cases.map(item => ({
    id: item.id,
    expected_class: item.expected_class,
    category: item.category,
    incomplete_context: ['submitted', 'existing'].some(side =>
      ['population', 'location', 'study_focus'].some(field => !item[side][field])
    ),
    scores: {
      [key]: scoreFor(weights, lexicalById.get(item.id), semanticById ? semanticById.get(item.id) : 0)
    }
  }));
}
function metrics(rows, key) { const statistics = calculateClassStatistics(rows, key); return { classStatistics: statistics, spearman: calculateSpearman(rows, key), concordance: calculateConcordance(rows, key), classMargins: calculateClassMargins(statistics) }; }
function predictFixed(score) { return score < .40 ? 'LOW' : score < .70 ? 'MEDIUM' : 'HIGH'; }
function classification(rows, key) { const actual = rows.map(item => item.expected_class); const predicted = rows.map(item => predictFixed(item.scores[key])); const perClass = {}; const matrix = Object.fromEntries(CLASSES.map(label => [label, { LOW: 0, MEDIUM: 0, HIGH: 0 }])); CLASSES.forEach(label => { let tp=0,fp=0,fn=0; actual.forEach((value,index)=>{if(predicted[index]===label&&value===label)tp++;if(predicted[index]===label&&value!==label)fp++;if(predicted[index]!==label&&value===label)fn++;}); const precision=tp+fp?tp/(tp+fp):0;const recall=tp+fn?tp/(tp+fn):0;perClass[label]={precision:round(precision),recall:round(recall),f1:round(precision+recall?2*precision*recall/(precision+recall):0)}; }); rows.forEach((row,index)=>{matrix[row.expected_class][predicted[index]]+=1;}); return { overall: { accuracy: round(actual.filter((value,index)=>value===predicted[index]).length/actual.length), macroPrecision: round(CLASSES.reduce((sum,label)=>sum+perClass[label].precision,0)/3), macroRecall: round(CLASSES.reduce((sum,label)=>sum+perClass[label].recall,0)/3), macroF1: round(CLASSES.reduce((sum,label)=>sum+perClass[label].f1,0)/3) }, perClass, confusionMatrix: matrix }; }
function gates(rows, key, semanticById) { const groups = Object.fromEntries(CLASSES.map(label => [label, { support: 0, generalMinimum: 0, semanticGate: 0 }])); rows.forEach(row => { const group=groups[row.expected_class];group.support+=1;if(row.scores[key]>=.10)group.generalMinimum+=1;if(row.scores[key]>=.60&&semanticById.get(row.id)>=.60)group.semanticGate+=1; }); const total=Object.values(groups).reduce((sum,g)=>sum+g.support,0);const sum=name=>Object.values(groups).reduce((s,g)=>s+g[name],0);return { generalMinimum:{passed:sum('generalMinimum'),proportion:round(sum('generalMinimum')/total)},semanticGate:{passed:sum('semanticGate'),proportion:round(sum('semanticGate')/total)},byExpectedClass:groups }; }
function subset(rows, key, incomplete) { return rows.filter(row => row.incomplete_context === incomplete); }
function contextSummary(rows, key) { const complete=subset(rows,key,false), incomplete=subset(rows,key,true); return { complete:{caseCount:complete.length,metrics:metrics(complete,key),fixedThreshold:classification(complete,key)}, incomplete:{caseCount:incomplete.length,metrics:metrics(incomplete,key),fixedThreshold:classification(incomplete,key)} }; }
function scenario(rows,key){const out={};rows.forEach(row=>{(out[row.category]??=[]).push(row);});return Object.fromEntries(Object.entries(out).map(([category,values])=>[category,{support:values.length,mean:round(values.reduce((sum,row)=>sum+row.scores[key],0)/values.length)}]));}
function bootstrap(models, grouped, components, options = {}) { const raw=Object.fromEntries(Object.entries(models).map(([name,value])=>[name,value.rows]));const predictions=Object.fromEntries(Object.entries(grouped).map(([name,value])=>[name,value.predictions]));return componentBootstrap(raw,predictions,components,{seed:20260810,replicates:5000,...options}); }
module.exports={CURRENT_WEIGHTS,ABLATIONS,titleOnlyLexical,records,metrics,predictFixed,classification,gates,contextSummary,scenario,groupedCrossValidate,bootstrap};
