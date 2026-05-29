const TITLE_ALIASES = [
  'title',
  'topic',
  'topic_title',
  'Topic Title',
  'Research Topic'
];

function normalizeDisplayValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim().replace(/\s+/g, ' ');
}

function normalizeTopicTitle(value) {
  return normalizeDisplayValue(value);
}

function makeTopicTitleKey(value) {
  return normalizeTopicTitle(value)
    .toLowerCase()
    .replace(/[.,;:!?'"`()\[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCategory(value) {
  return normalizeDisplayValue(value);
}

function makeCategoryKey(value) {
  return normalizeCategory(value).toLowerCase();
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeDisplayValue).filter(Boolean);
  }

  const keywordText = normalizeDisplayValue(value);

  if (!keywordText) {
    return [];
  }

  return keywordText.split(',').map(normalizeDisplayValue).filter(Boolean);
}

function getTopicTitleValue(rowOrTitle) {
  if (
    rowOrTitle &&
    typeof rowOrTitle === 'object' &&
    !Array.isArray(rowOrTitle)
  ) {
    const matchedAlias = TITLE_ALIASES.find(alias =>
      Object.prototype.hasOwnProperty.call(rowOrTitle, alias)
    );

    return matchedAlias ? rowOrTitle[matchedAlias] : undefined;
  }

  return rowOrTitle;
}

function hasRequiredTitle(rowOrTitle) {
  return normalizeTopicTitle(getTopicTitleValue(rowOrTitle)).length > 0;
}

function detectInBatchDuplicateTitleKeys(rows) {
  if (!Array.isArray(rows)) {
    throw new Error('rows must be an array');
  }

  const seenByTitleKey = new Map();
  const duplicates = [];

  rows.forEach((row, rowIndex) => {
    const title = normalizeTopicTitle(getTopicTitleValue(row));
    const titleKey = makeTopicTitleKey(title);

    if (!titleKey) {
      return;
    }

    if (seenByTitleKey.has(titleKey)) {
      const firstMatch = seenByTitleKey.get(titleKey);

      duplicates.push({
        rowIndex,
        firstRowIndex: firstMatch.rowIndex,
        title,
        firstTitle: firstMatch.title,
        titleKey,
        row
      });

      return;
    }

    seenByTitleKey.set(titleKey, { rowIndex, title, row });
  });

  return duplicates;
}

module.exports = {
  normalizeTopicTitle,
  makeTopicTitleKey,
  normalizeCategory,
  makeCategoryKey,
  normalizeKeywords,
  hasRequiredTitle,
  detectInBatchDuplicateTitleKeys
};
