const {
  normalizeTopicTitle,
  makeTopicTitleKey,
  normalizeCategory,
  makeCategoryKey,
  normalizeKeywords,
  hasRequiredTitle,
  detectInBatchDuplicateTitleKeys
} = require('./topicNormalization');
const fixtures = require('./topicDataQuality.fixtures');

describe('Topic Normalization Utilities', () => {
  describe('normalizeTopicTitle', () => {
    test('should trim and collapse whitespace while preserving display text', () => {
      expect(normalizeTopicTitle(fixtures.extraSpaceTitleRow.title)).toBe(
        'Maternal Health Awareness in Rural Communities'
      );
      expect(normalizeTopicTitle(fixtures.mixedCaseTitleRow.title)).toBe(
        'maternal health awareness IN rural communities'
      );
      expect(normalizeTopicTitle(fixtures.punctuationVariantTitleRow.title)).toBe(
        'Maternal Health Awareness in Rural Communities.'
      );
    });

    test('should not invent missing titles', () => {
      expect(normalizeTopicTitle('')).toBe('');
      expect(normalizeTopicTitle('   ')).toBe('');
      expect(normalizeTopicTitle(null)).toBe('');
      expect(normalizeTopicTitle(undefined)).toBe('');
    });
  });

  describe('makeTopicTitleKey', () => {
    test('should create stable comparison keys from casing and spacing variants', () => {
      const expectedKey = 'maternal health awareness in rural communities';

      expect(makeTopicTitleKey(fixtures.validCleanRow.title)).toBe(expectedKey);
      expect(makeTopicTitleKey(fixtures.extraSpaceTitleRow.title)).toBe(expectedKey);
      expect(makeTopicTitleKey(fixtures.mixedCaseTitleRow.title)).toBe(expectedKey);
    });

    test('should remove simple punctuation from comparison keys only', () => {
      expect(makeTopicTitleKey(fixtures.punctuationVariantTitleRow.title)).toBe(
        'maternal health awareness in rural communities'
      );
      expect(normalizeTopicTitle(fixtures.punctuationVariantTitleRow.title)).toBe(
        'Maternal Health Awareness in Rural Communities.'
      );
    });
  });

  describe('normalizeCategory', () => {
    test('should normalize category display values conservatively', () => {
      expect(normalizeCategory(fixtures.extraSpaceTitleRow.category)).toBe('Public Health');
      expect(normalizeCategory(fixtures.categoryCasingRow.category)).toBe(
        'environmental health'
      );
    });

    test('should create category comparison keys without guessing categories', () => {
      expect(makeCategoryKey('  Public   Health  ')).toBe('public health');
      expect(normalizeCategory(null)).toBe('');
      expect(makeCategoryKey(undefined)).toBe('');
    });
  });

  describe('normalizeKeywords', () => {
    test('should normalize comma-separated keyword strings', () => {
      expect(normalizeKeywords(fixtures.commaKeywordRow.keywords)).toEqual([
        'health',
        'students',
        'awareness'
      ]);
    });

    test('should normalize keyword arrays without inventing missing keywords', () => {
      expect(normalizeKeywords(fixtures.arrayKeywordRow.keywords)).toEqual([
        'health',
        'students',
        'awareness'
      ]);
      expect(normalizeKeywords(null)).toEqual([]);
      expect(normalizeKeywords(undefined)).toEqual([]);
      expect(normalizeKeywords('   ')).toEqual([]);
    });
  });

  describe('hasRequiredTitle', () => {
    test('should validate direct title values', () => {
      expect(hasRequiredTitle('Malaria Prevention Among Students')).toBe(true);
      expect(hasRequiredTitle('   ')).toBe(false);
      expect(hasRequiredTitle(null)).toBe(false);
    });

    test('should validate supported title aliases on import-like rows', () => {
      expect(hasRequiredTitle({ title: 'Title Alias' })).toBe(true);
      expect(hasRequiredTitle({ topic: 'Topic Alias' })).toBe(true);
      expect(hasRequiredTitle({ topic_title: 'Topic Title Alias' })).toBe(true);
      expect(hasRequiredTitle({ 'Topic Title': 'Spaced Topic Title Alias' })).toBe(true);
      expect(hasRequiredTitle({ 'Research Topic': 'Research Topic Alias' })).toBe(true);
      expect(hasRequiredTitle({ keywords: 'health' })).toBe(false);
      expect(hasRequiredTitle(fixtures.missingTitleRow)).toBe(false);
    });
  });

  describe('detectInBatchDuplicateTitleKeys', () => {
    test('should detect duplicate title keys without mutating rows', () => {
      const rows = fixtures.duplicateBatchRows.map(row => ({ ...row }));
      const originalRows = rows.map(row => ({ ...row }));

      const duplicates = detectInBatchDuplicateTitleKeys(rows);

      expect(duplicates).toEqual([
        {
          rowIndex: 1,
          firstRowIndex: 0,
          title: 'maternal health awareness in rural communities',
          firstTitle: 'Maternal Health Awareness in Rural Communities',
          titleKey: 'maternal health awareness in rural communities',
          row: rows[1]
        },
        {
          rowIndex: 2,
          firstRowIndex: 0,
          title: 'Maternal Health Awareness in Rural Communities.',
          firstTitle: 'Maternal Health Awareness in Rural Communities',
          titleKey: 'maternal health awareness in rural communities',
          row: rows[2]
        }
      ]);
      expect(rows).toEqual(originalRows);
    });

    test('should ignore rows without required titles and reject non-array input', () => {
      expect(detectInBatchDuplicateTitleKeys([fixtures.missingTitleRow])).toEqual([]);
      expect(() => detectInBatchDuplicateTitleKeys({ title: 'Not Array' })).toThrow(
        'rows must be an array'
      );
    });
  });

  describe('data-quality fixture boundaries', () => {
    test('should accept incomplete metadata only as a title-valid row', () => {
      expect(hasRequiredTitle(fixtures.incompleteMetadataRow)).toBe(true);
      expect(fixtures.incompleteMetadataRow.population).toBeUndefined();
      expect(fixtures.incompleteMetadataRow.location).toBeUndefined();
      expect(fixtures.incompleteMetadataRow.study_focus).toBeUndefined();
      expect(fixtures.incompleteMetadataRow.supervisor).toBeUndefined();
      expect(fixtures.incompleteMetadataRow.session).toBeUndefined();
    });
  });
});
