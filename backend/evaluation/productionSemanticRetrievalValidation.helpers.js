const { formatStructuredContext } = require('./sbertInputRepresentation.helpers');
function voyageText(topic){return formatStructuredContext(topic);}
function geminiQuery(topic){return `task: search result | query: ${formatStructuredContext(topic)}`;}
function geminiDocument(topic){const text=[topic.population,topic.location,topic.study_focus].filter(x=>typeof x==='string'&&x.trim()).join('\n')||topic.title;return `title: ${topic.title} | text: ${text}`;}
function cosine(a,b){let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i+=1){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
function pairScores(cases,byTopic){return cases.map(item=>{const a=formatStructuredContext(item.submitted),b=formatStructuredContext(item.existing),ab=cosine(byTopic.get(a).query,byTopic.get(b).document),ba=cosine(byTopic.get(b).query,byTopic.get(a).document);return {id:item.id,expected_class:item.expected_class,scores:{value:(ab+ba)/2},score_ab:ab,score_ba:ba,directionDifference:Math.abs(ab-ba)};});}
module.exports={voyageText,geminiQuery,geminiDocument,cosine,pairScores};
