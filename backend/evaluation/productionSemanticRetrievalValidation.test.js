const { voyageText, geminiQuery, geminiDocument, pairScores } = require('./productionSemanticRetrievalValidation.helpers');
describe('production semantic retrieval validation', () => {
  const topic={title:'Malaria prevention',population:'Pregnant women',location:'Lagos',study_focus:'Bed net uptake'};
  test('uses documented Voyage role inputs without double prompting',()=>{expect(voyageText(topic)).toBe('Title: Malaria prevention\nPopulation: Pregnant women\nLocation: Lagos\nStudy focus: Bed net uptake');});
  test('uses Gemini query/document mappings without benchmark metadata or title duplication',()=>{expect(geminiQuery(topic)).toBe('task: search result | query: Title: Malaria prevention\nPopulation: Pregnant women\nLocation: Lagos\nStudy focus: Bed net uptake');expect(geminiDocument(topic)).toBe('title: Malaria prevention | text: Pregnant women\nLagos\nBed net uptake');});
  test('uses one pair mean from both directions',()=>{const t='Title: Malaria prevention\nPopulation: Pregnant women\nLocation: Lagos\nStudy focus: Bed net uptake';const rows=pairScores([{id:'x',expected_class:'HIGH',submitted:topic,existing:topic}],new Map([[t,{query:[1,0],document:[1,0]}]]));expect(rows[0].scores.value).toBe(1);expect(rows[0].directionDifference).toBe(0);});
});
