const crypto = require('crypto');

const REPRESENTATION_ID = 'structured-context-v1';
function text(value, required = false) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (required && !normalized) throw new Error('Topic title is required for semantic representation.');
  return normalized;
}
function serialize(topic) {
  return [
    `Title: ${text(topic?.title, true)}`,
    text(topic?.population) && `Population: ${text(topic.population)}`,
    text(topic?.location) && `Location: ${text(topic.location)}`,
    text(topic?.studyFocus ?? topic?.study_focus) && `Study focus: ${text(topic.studyFocus ?? topic.study_focus)}`
  ].filter(Boolean).join('\n');
}
function sourceHash(topic) { return crypto.createHash('sha256').update(serialize(topic)).digest('hex'); }
module.exports = { REPRESENTATION_ID, serialize, sourceHash };
