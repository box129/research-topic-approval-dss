const topicDataQualityFixtures = {
  validCleanRow: {
    title: 'Maternal Health Awareness in Rural Communities',
    category: 'Public Health',
    keywords: 'maternal health, awareness',
    population: 'Pregnant women',
    location: 'Osun State',
    study_focus: 'Health awareness'
  },
  extraSpaceTitleRow: {
    title: '  Maternal   Health   Awareness in   Rural Communities  ',
    category: '  Public   Health  ',
    keywords: ' maternal health, awareness '
  },
  mixedCaseTitleRow: {
    title: 'maternal health awareness IN rural communities',
    category: 'public health'
  },
  punctuationVariantTitleRow: {
    title: 'Maternal Health Awareness in Rural Communities.',
    category: 'Public Health'
  },
  missingTitleRow: {
    title: '   ',
    category: 'Public Health',
    keywords: 'maternal health'
  },
  incompleteMetadataRow: {
    title: 'Nutrition Knowledge Among Secondary School Students',
    category: 'Nutrition',
    keywords: 'nutrition, students'
  },
  categoryCasingRow: {
    title: 'Category Casing Topic',
    category: '  environmental   health  '
  },
  commaKeywordRow: {
    title: 'Keyword String Topic',
    keywords: 'health, students, , awareness '
  },
  arrayKeywordRow: {
    title: 'Keyword Array Topic',
    keywords: [' health ', '', 'students', null, 'awareness']
  },
  duplicateBatchRows: [
    {
      title: 'Maternal Health Awareness in Rural Communities',
      category: 'Public Health'
    },
    {
      title: ' maternal   health awareness in rural communities ',
      category: 'public health'
    },
    {
      title: 'Maternal Health Awareness in Rural Communities.',
      category: 'Public Health'
    },
    {
      title: '',
      category: 'Public Health'
    }
  ]
};

module.exports = topicDataQualityFixtures;
