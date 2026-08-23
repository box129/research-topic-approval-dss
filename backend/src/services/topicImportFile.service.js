const ExcelJS = require('exceljs');
const { normalizeTopicImportRows } = require('./topicImport.service');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function normalizeCellValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isPlainObject(value)) {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) {
      return normalizeCellValue(value.result);
    }

    if (Array.isArray(value.richText)) {
      return value.richText.map(part => normalizeCellValue(part.text)).join('');
    }

    if (Object.prototype.hasOwnProperty.call(value, 'text')) {
      return normalizeCellValue(value.text);
    }

    if (Object.prototype.hasOwnProperty.call(value, 'hyperlink')) {
      return normalizeCellValue(value.text || value.hyperlink);
    }

    return JSON.stringify(value);
  }

  return String(value);
}

function getRowValues(row) {
  if (Array.isArray(row.values)) {
    return row.values.slice(1).map(normalizeCellValue);
  }

  return [];
}

function isNonEmptyRow(values) {
  return values.some(value => String(value).trim() !== '');
}

function buildEmptyReport() {
  return normalizeTopicImportRows([]);
}

function parseWorksheetRows(worksheet) {
  let headers = null;
  const rows = [];
  const rowNumbers = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = getRowValues(row);

    if (!isNonEmptyRow(values)) {
      return;
    }

    if (!headers) {
      headers = values.map(value => String(value).trim());
      return;
    }

    const parsedRow = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      if (!header) {
        return;
      }

      const value = values[index] === undefined ? '' : values[index];
      parsedRow[header] = value;

      if (String(value).trim() !== '') {
        hasValue = true;
      }
    });

    if (hasValue) {
      rows.push(parsedRow);
      rowNumbers.push(rowNumber);
    }
  });

  return { headers: headers || [], rows, rowNumbers };
}

async function normalizeTopicImportFile(filePath, options = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = options.sheetName
    ? workbook.getWorksheet(options.sheetName)
    : workbook.worksheets[0];

  if (!worksheet && options.sheetName) {
    throw new Error('worksheet not found');
  }

  if (!worksheet) {
    const emptyResult = buildEmptyReport();
    return {
      ...emptyResult,
      metadata: {
        sheet_name: null,
        total_parsed_rows: 0,
        warnings: ['missing header row']
      }
    };
  }

  const { headers, rows } = parseWorksheetRows(worksheet);
  const warnings = [];

  if (!headers.some(Boolean)) {
    warnings.push('missing header row');
  }

  const result = normalizeTopicImportRows(headers.some(Boolean) ? rows : []);

  return {
    ...result,
    metadata: {
      sheet_name: worksheet.name,
      total_parsed_rows: headers.some(Boolean) ? rows.length : 0,
      warnings
    }
  };
}

module.exports = {
  normalizeTopicImportFile,
  parseWorksheetRows
};
