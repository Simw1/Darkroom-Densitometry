/**
 * Film Process Control - Google Apps Script Backend
 * University of Westminster Harrow Darkroom
 *
 * TEMPLATE-BASED VERSION
 * This script appends data to pre-formatted sheets that match your Excel templates.
 *
 * SETUP INSTRUCTIONS:
 * 1. Import your Excel files into Google Sheets (File > Import)
 *    - Import "C-41 2024.xlsx" and "BW 2024.xlsx"
 *    - Or create sheets manually matching the template structure
 * 2. Go to Extensions > Apps Script
 * 3. Paste this entire code
 * 4. Click Deploy > New deployment
 * 5. Select "Web app" as the type
 * 6. Set "Execute as" to your account
 * 7. Set "Who has access" to "Anyone"
 * 8. Click Deploy and copy the Web App URL
 * 9. Paste the URL into index.html where it says YOUR_APPS_SCRIPT_URL_HERE
 *
 * TEMPLATE STRUCTURE EXPECTED:
 *
 * C-41 Sheets (named like "Nov 2025", "Dec 2025"):
 *   Row 2: Reference values in columns E-P
 *   Row 3-4: Headers
 *   Row 5+: Data rows
 *   Columns: A=Notes, B=empty, C=Date from, D=Date until,
 *            E-G=D-max RGB, H-J=HD RGB, K-M=LD RGB, N-P=D-min RGB
 *   Columns S-AD: Deviation data (mirrored structure)
 *
 * B&W Sheets (named like "June 2025", "Jan 2025"):
 *   Row 2: Reference values
 *   Row 3-4: Headers
 *   Row 5+: Data rows
 *   Columns: A=Notes, B=Date, C=D-max, D=HD, E=LD, F=D-min, G=HD-LD (formula)
 */

// Configuration - adjust these if your template differs
const CONFIG = {
  c41: {
    dataStartRow: 5,        // First row for data entry
    dateCol: 3,             // Column C
    dmaxStartCol: 5,        // Column E (D-max R)
    hdStartCol: 8,          // Column H (HD R)
    ldStartCol: 11,         // Column K (LD R)
    dminStartCol: 14,       // Column N (D-min R)
    // Deviation columns (right side of sheet)
    devDateCol: 18,         // Column R
    devDmaxStartCol: 19,    // Column S
    devHdStartCol: 22,      // Column V (HD+LD in your sheet)
    devLdStartCol: 25,      // Column Y
    devDminStartCol: 28,    // Column AB
    notesCol: 1             // Column A
  },
  bw: {
    dataStartRow: 5,        // First row for data entry
    notesCol: 1,            // Column A
    dateCol: 2,             // Column B
    dmaxCol: 3,             // Column C
    hdCol: 4,               // Column D
    ldCol: 5,               // Column E
    dminCol: 6,             // Column F
    hdldCol: 7              // Column G (usually has formula =E-F or similar)
  }
};

/**
 * Handle incoming POST requests from the web app
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const result = logReading(data);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'Film Process Control API is running',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Log a reading to the appropriate sheet
 */
function logReading(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getMonthlySheetName(data.process);

  let sheet = ss.getSheetByName(sheetName);

  // If sheet doesn't exist, try to copy from BLANK template
  if (!sheet) {
    const blankSheet = ss.getSheetByName('BLANK');
    if (blankSheet) {
      sheet = blankSheet.copyTo(ss);
      sheet.setName(sheetName);
    } else {
      // Fall back to creating a basic sheet
      sheet = createBasicSheet(ss, sheetName, data.process);
    }
  }

  // Find the next empty row in the data section
  const nextRow = findNextEmptyRow(sheet, data.process);

  // Write the data
  if (data.process === 'c41') {
    writeC41Data(sheet, nextRow, data);
  } else {
    writeBWData(sheet, nextRow, data);
  }

  return { sheet: sheetName, row: nextRow };
}

/**
 * Get monthly sheet name matching your Excel format
 * e.g., "Nov 2025", "Dec 2025"
 */
function getMonthlySheetName(process) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June',
                  'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  return months[now.getMonth()] + ' ' + now.getFullYear();
}

/**
 * Find the next empty row in the data section
 */
function findNextEmptyRow(sheet, process) {
  const startRow = process === 'c41' ? CONFIG.c41.dataStartRow : CONFIG.bw.dataStartRow;
  const checkCol = process === 'c41' ? CONFIG.c41.dateCol : CONFIG.bw.dateCol;

  // Get all values in the date column starting from data row
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) {
    return startRow;
  }

  const range = sheet.getRange(startRow, checkCol, lastRow - startRow + 1, 1);
  const values = range.getValues();

  // Find first empty cell
  for (let i = 0; i < values.length; i++) {
    if (!values[i][0] || values[i][0] === '') {
      return startRow + i;
    }
  }

  // All rows filled, add new row
  return lastRow + 1;
}

/**
 * Write C-41 data to the sheet
 */
function writeC41Data(sheet, row, data) {
  const cfg = CONFIG.c41;

  // Date (just the date, your template uses single column)
  sheet.getRange(row, cfg.dateCol).setValue(data.date);

  // Raw readings - D-max RGB
  sheet.getRange(row, cfg.dmaxStartCol).setValue(data.readings.dmax.r);
  sheet.getRange(row, cfg.dmaxStartCol + 1).setValue(data.readings.dmax.g);
  sheet.getRange(row, cfg.dmaxStartCol + 2).setValue(data.readings.dmax.b);

  // HD RGB
  sheet.getRange(row, cfg.hdStartCol).setValue(data.readings.hd.r);
  sheet.getRange(row, cfg.hdStartCol + 1).setValue(data.readings.hd.g);
  sheet.getRange(row, cfg.hdStartCol + 2).setValue(data.readings.hd.b);

  // LD RGB
  sheet.getRange(row, cfg.ldStartCol).setValue(data.readings.ld.r);
  sheet.getRange(row, cfg.ldStartCol + 1).setValue(data.readings.ld.g);
  sheet.getRange(row, cfg.ldStartCol + 2).setValue(data.readings.ld.b);

  // D-min RGB
  sheet.getRange(row, cfg.dminStartCol).setValue(data.readings.dmin.r);
  sheet.getRange(row, cfg.dminStartCol + 1).setValue(data.readings.dmin.g);
  sheet.getRange(row, cfg.dminStartCol + 2).setValue(data.readings.dmin.b);

  // Deviation side - Date
  sheet.getRange(row, cfg.devDateCol).setValue(data.date);

  // Deviation D-max RGB
  sheet.getRange(row, cfg.devDmaxStartCol).setValue(data.readings.dmax.r);
  sheet.getRange(row, cfg.devDmaxStartCol + 1).setValue(data.readings.dmax.g);
  sheet.getRange(row, cfg.devDmaxStartCol + 2).setValue(data.readings.dmax.b);

  // Deviation HD+LD RGB (HD-LD values)
  sheet.getRange(row, cfg.devHdStartCol).setValue(data.hdld.r);
  sheet.getRange(row, cfg.devHdStartCol + 1).setValue(data.hdld.g);
  sheet.getRange(row, cfg.devHdStartCol + 2).setValue(data.hdld.b);

  // Deviation LD RGB
  sheet.getRange(row, cfg.devLdStartCol).setValue(data.readings.ld.r);
  sheet.getRange(row, cfg.devLdStartCol + 1).setValue(data.readings.ld.g);
  sheet.getRange(row, cfg.devLdStartCol + 2).setValue(data.readings.ld.b);

  // Deviation D-min RGB
  sheet.getRange(row, cfg.devDminStartCol).setValue(data.readings.dmin.r);
  sheet.getRange(row, cfg.devDminStartCol + 1).setValue(data.readings.dmin.g);
  sheet.getRange(row, cfg.devDminStartCol + 2).setValue(data.readings.dmin.b);

  // Notes (Column A)
  if (data.notes) {
    sheet.getRange(row, cfg.notesCol).setValue(data.notes);
  }
}

/**
 * Write B&W data to the sheet
 */
function writeBWData(sheet, row, data) {
  const cfg = CONFIG.bw;

  // Notes (Column A) - optional
  if (data.notes) {
    sheet.getRange(row, cfg.notesCol).setValue(data.notes);
  }

  // Date (Column B)
  sheet.getRange(row, cfg.dateCol).setValue(data.date);

  // D-max (Column C)
  sheet.getRange(row, cfg.dmaxCol).setValue(data.readings.dmax);

  // HD (Column D)
  sheet.getRange(row, cfg.hdCol).setValue(data.readings.hd);

  // LD (Column E)
  sheet.getRange(row, cfg.ldCol).setValue(data.readings.ld);

  // D-min (Column F)
  sheet.getRange(row, cfg.dminCol).setValue(data.readings.dmin);

  // HD-LD (Column G) - Set formula to match your template
  // Your template uses =E{row}-F{row} or similar
  const hdldFormula = '=' + columnToLetter(cfg.hdCol) + row + '-' + columnToLetter(cfg.ldCol) + row;
  sheet.getRange(row, cfg.hdldCol).setFormula(hdldFormula);
}

/**
 * Convert column number to letter (1=A, 2=B, etc.)
 */
function columnToLetter(column) {
  let letter = '';
  while (column > 0) {
    let temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = Math.floor((column - temp - 1) / 26);
  }
  return letter;
}

/**
 * Create a basic sheet if no BLANK template exists
 * This is a fallback - ideally you'll have a BLANK template
 */
function createBasicSheet(ss, sheetName, process) {
  const sheet = ss.insertSheet(sheetName);

  if (process === 'c41') {
    // Basic C-41 setup
    sheet.getRange('A1').setValue('Notes');
    sheet.getRange('C1').setValue('Date');
    sheet.getRange('E1').setValue('D-max');
    sheet.getRange('H1').setValue('HD');
    sheet.getRange('K1').setValue('LD');
    sheet.getRange('N1').setValue('D-min');
  } else {
    // Basic B&W setup matching your template
    sheet.getRange('A3').setValue('Notes');
    sheet.getRange('B3').setValue('Date');
    sheet.getRange('C3').setValue('D-max');
    sheet.getRange('D3').setValue('HD');
    sheet.getRange('E3').setValue('LD');
    sheet.getRange('F3').setValue('D-min');
    sheet.getRange('G3').setValue('HD-LD');
  }

  return sheet;
}

/**
 * Utility: Get recent readings from a sheet
 */
function getRecentReadings(process, count) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getMonthlySheetName(process);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return [];
  }

  const startRow = process === 'c41' ? CONFIG.c41.dataStartRow : CONFIG.bw.dataStartRow;
  const lastRow = sheet.getLastRow();

  if (lastRow < startRow) {
    return [];
  }

  const dataRows = lastRow - startRow + 1;
  const rowsToGet = Math.min(count, dataRows);
  const fromRow = lastRow - rowsToGet + 1;

  const numCols = process === 'c41' ? 30 : 7;
  const data = sheet.getRange(fromRow, 1, rowsToGet, numCols).getValues();

  return data.reverse();
}

/**
 * Test function - run this to verify the script is working
 */
function testLog() {
  const testData = {
    date: '05/12/2025',
    time: '14:30',
    process: 'bw',
    readings: {
      dmax: 170,
      hd: 146,
      ld: 50,
      dmin: 30
    },
    deviations: {
      ld: -2,
      hdld: 3,
      dmin: 1
    },
    hdld: 96,
    status: 'ok',
    problems: 'Process within limits',
    notes: 'Test from web app'
  };

  const result = logReading(testData);
  Logger.log('Test result: ' + JSON.stringify(result));
}

/**
 * Test C-41 logging
 */
function testC41Log() {
  const testData = {
    date: '05/12/2025',
    time: '14:30',
    process: 'c41',
    readings: {
      dmax: { r: 163, g: 245, b: 275 },
      hd: { r: 172, g: 310, b: 336 },
      ld: { r: 39, g: 94, b: 103 },
      dmin: { r: 28, g: 74, b: 96 }
    },
    deviations: {
      dmin: { r: 0, g: 0, b: 0 },
      ld: { r: 0, g: 0, b: 0 },
      hdld: { r: 0, g: 0, b: 0 }
    },
    hdld: { r: 133, g: 216, b: 233 },
    status: 'ok',
    problems: 'Process within limits',
    notes: 'Test C-41 entry'
  };

  const result = logReading(testData);
  Logger.log('Test C-41 result: ' + JSON.stringify(result));
}
