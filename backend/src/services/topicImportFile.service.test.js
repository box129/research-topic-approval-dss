const mockReadFile = jest.fn();
const mockGetWorksheet = jest.fn();
let mockWorksheets = [];

// ExcelJS is installed in the test environment.  This must be a normal mock,
// rather than a virtual mock, so Jest replaces a module that another test may
// already have resolved during a full --runInBand suite.
jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => ({
    xlsx: {
      readFile: mockReadFile
    },
    getWorksheet: mockGetWorksheet,
    get worksheets() {
      return mockWorksheets;
    }
  }))
}));

const topicImportService = require('./topicImport.service');

jest.mock('./topicImport.service', () => ({
  normalizeTopicImportRows: jest.fn(jest.requireActual('./topicImport.service').normalizeTopicImportRows)
}));

const { normalizeTopicImportFile } = require('./topicImportFile.service');

function createWorksheet(name, rows) {
  return {
    name,
    eachRow(callback) {
      rows.forEach(values => {
        callback({ values: [undefined, ...values] });
      });
    }
  };
}

describe('Topic Import File Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorksheets = [];
    mockReadFile.mockResolvedValue(undefined);
    mockGetWorksheet.mockImplementation(name => mockWorksheets.find(sheet => sheet.name === name));
  });

  test('should normalize a spreadsheet with one valid complete topic row', async () => {
    mockWorksheets = [
      createWorksheet('Topics', [
        ['title', 'keywords', 'population', 'location', 'study_focus', 'lifecycle_bucket'],
        ['Maternal Health Topic', 'maternal, health', 'Pregnant women', 'Oyo State', 'Health awareness', 'current_session']
      ])
    ];

    const result = await normalizeTopicImportFile('topics.xlsx');

    expect(result.records[0]).toMatchObject({
      title: 'Maternal Health Topic',
      keywords: ['maternal', 'health'],
      population: 'Pregnant women',
      location: 'Oyo State',
      study_focus: 'Health awareness',
      lifecycle_bucket: 'current_session'
    });
    expect(result.report.accepted_rows).toBe(1);
    expect(result.metadata).toEqual({
      sheet_name: 'Topics',
      total_parsed_rows: 1,
      warnings: []
    });
  });

  test('should pass missing optional context through the normalizer', async () => {
    mockWorksheets = [
      createWorksheet('Topics', [
        ['title', 'keywords'],
        ['Nutrition Knowledge Topic', 'nutrition']
      ])
    ];

    const result = await normalizeTopicImportFile('topics.xlsx');

    expect(result.records[0].warnings).toEqual([
      'missing population',
      'missing location',
      'missing study_focus'
    ]);
    expect(result.report.incomplete_context_rows).toBe(1);
  });

  test('should pass missing title rows through the normalizer', async () => {
    mockWorksheets = [
      createWorksheet('Topics', [
        ['title', 'keywords'],
        ['', 'health']
      ])
    ];

    const result = await normalizeTopicImportFile('topics.xlsx');

    expect(result.records).toEqual([]);
    expect(result.report.skipped_rows).toBe(1);
    expect(result.report.missing_title_rows).toBe(1);
  });

  test('should pass duplicate title rows through the normalizer', async () => {
    mockWorksheets = [
      createWorksheet('Topics', [
        ['title'],
        ['Repeated Topic'],
        [' repeated topic ']
      ])
    ];

    const result = await normalizeTopicImportFile('topics.xlsx');

    expect(result.records).toHaveLength(1);
    expect(result.report.skipped_rows).toBe(1);
    expect(result.report.duplicate_title_rows).toBe(1);
  });

  test('should handle an empty spreadsheet safely', async () => {
    mockWorksheets = [];

    const result = await normalizeTopicImportFile('empty.xlsx');

    expect(result.records).toEqual([]);
    expect(result.report).toEqual({
      total_rows: 0,
      accepted_rows: 0,
      skipped_rows: 0,
      missing_title_rows: 0,
      incomplete_context_rows: 0,
      duplicate_title_rows: 0
    });
    expect(result.metadata).toEqual({
      sheet_name: null,
      total_parsed_rows: 0,
      warnings: ['missing header row']
    });
  });

  test('should handle a worksheet with no usable header row safely', async () => {
    mockWorksheets = [
      createWorksheet('Blank', [
        ['', '', ''],
        ['', '', '']
      ])
    ];

    const result = await normalizeTopicImportFile('blank.xlsx');

    expect(result.records).toEqual([]);
    expect(result.report.total_rows).toBe(0);
    expect(result.metadata).toEqual({
      sheet_name: 'Blank',
      total_parsed_rows: 0,
      warnings: ['missing header row']
    });
  });

  test('should throw when requested worksheet name does not exist', async () => {
    mockWorksheets = [createWorksheet('Topics', [['title'], ['Valid Topic']])];

    await expect(normalizeTopicImportFile('topics.xlsx', { sheetName: 'Missing' }))
      .rejects
      .toThrow('worksheet not found');
  });

  test('should reuse normalizeTopicImportRows', async () => {
    mockWorksheets = [
      createWorksheet('Topics', [
        ['title'],
        ['Reuse Normalizer Topic']
      ])
    ];

    await normalizeTopicImportFile('topics.xlsx');

    expect(topicImportService.normalizeTopicImportRows).toHaveBeenCalledWith([
      { title: 'Reuse Normalizer Topic' }
    ]);
  });

  test('should return report shape from the normalizer', async () => {
    mockWorksheets = [
      createWorksheet('Topics', [
        ['title'],
        ['Report Shape Topic']
      ])
    ];

    const result = await normalizeTopicImportFile('topics.xlsx');

    expect(result.report).toEqual(expect.objectContaining({
      total_rows: 1,
      accepted_rows: 1,
      skipped_rows: 0,
      missing_title_rows: 0,
      incomplete_context_rows: 1,
      duplicate_title_rows: 0
    }));
  });

  test('should convert safe Excel cell values before normalization', async () => {
    const date = new Date('2025-01-02T03:04:05.000Z');
    mockWorksheets = [
      createWorksheet('Topics', [
        ['title', 'keywords', 'population', 'location', 'study_focus', 'year', 'active', 'review_started_at'],
        ['Typed Values Topic', 'typed, values', 300, true, { richText: [{ text: 'Study ' }, { text: 'Focus' }] }, 2025, false, date]
      ])
    ];

    const result = await normalizeTopicImportFile('typed.xlsx');

    expect(result.records[0]).toMatchObject({
      title: 'Typed Values Topic',
      keywords: ['typed', 'values'],
      population: '300',
      location: 'true',
      study_focus: 'Study Focus'
    });
    expect(result.records[0].raw_record.year).toBe(2025);
    expect(result.records[0].raw_record.active).toBe(false);
    expect(result.records[0].raw_record.review_started_at).toBe('2025-01-02T03:04:05.000Z');
  });
});
