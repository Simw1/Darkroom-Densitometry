/**
 * Film Process Control - Google Apps Script Backend
 * University of Westminster Harrow Darkroom
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Paste this entire code
 * 4. Click Deploy > New deployment
 * 5. Select "Web app" as the type
 * 6. Set "Execute as" to your account
 * 7. Set "Who has access" to "Anyone"
 * 8. Click Deploy and copy the Web App URL
 * 9. Paste the URL into index.html where it says YOUR_APPS_SCRIPT_URL_HERE
 */

// Configuration
const CONFIG = {
  // Sheet names for each process
  sheetNames: {
    c41: 'C-41',
    bw: 'B&W'
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
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = createProcessSheet(ss, sheetName, data.process);
  }
  
  // Append the row
  const row = formatRow(data);
  sheet.appendRow(row);
  
  return { sheet: sheetName, row: sheet.getLastRow() };
}

/**
 * Get monthly sheet name (e.g., "C-41 Dec 2025")
 */
function getMonthlySheetName(process) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const monthYear = months[now.getMonth()] + ' ' + now.getFullYear();
  const prefix = CONFIG.sheetNames[process] || process.toUpperCase();
  return prefix + ' ' + monthYear;
}

/**
 * Create a new sheet with proper headers
 */
function createProcessSheet(ss, sheetName, process) {
  const sheet = ss.insertSheet(sheetName);
  
  if (process === 'c41') {
    // C-41 headers
    sheet.appendRow([
      'Date', 'Time',
      'D-max R', 'D-max G', 'D-max B',
      'HD R', 'HD G', 'HD B',
      'LD R', 'LD G', 'LD B',
      'D-min R', 'D-min G', 'D-min B',
      'HD-LD R', 'HD-LD G', 'HD-LD B',
      'Dev D-min R', 'Dev D-min G', 'Dev D-min B',
      'Dev LD R', 'Dev LD G', 'Dev LD B',
      'Dev HD-LD R', 'Dev HD-LD G', 'Dev HD-LD B',
      'Status', 'Diagnosis', 'Notes'
    ]);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, 29);
    headerRange.setBackground('#1a1a2e');
    headerRange.setFontColor('#e2e8f0');
    headerRange.setFontWeight('bold');
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
  } else {
    // B&W headers
    sheet.appendRow([
      'Date', 'Time',
      'D-max', 'HD', 'LD', 'D-min', 'HD-LD',
      'Dev LD', 'Dev HD-LD',
      'Status', 'Diagnosis', 'Notes'
    ]);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, 12);
    headerRange.setBackground('#1a1a2e');
    headerRange.setFontColor('#e2e8f0');
    headerRange.setFontWeight('bold');
    
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Format data into a row array
 */
function formatRow(data) {
  if (data.process === 'c41') {
    return [
      data.date,
      data.time,
      // Raw readings
      data.readings.dmax.r, data.readings.dmax.g, data.readings.dmax.b,
      data.readings.hd.r, data.readings.hd.g, data.readings.hd.b,
      data.readings.ld.r, data.readings.ld.g, data.readings.ld.b,
      data.readings.dmin.r, data.readings.dmin.g, data.readings.dmin.b,
      // HD-LD
      data.hdld.r, data.hdld.g, data.hdld.b,
      // Deviations
      data.deviations.dmin.r, data.deviations.dmin.g, data.deviations.dmin.b,
      data.deviations.ld.r, data.deviations.ld.g, data.deviations.ld.b,
      data.deviations.hdld.r, data.deviations.hdld.g, data.deviations.hdld.b,
      // Status and notes
      data.status.toUpperCase(),
      data.problems,
      data.notes
    ];
  } else {
    return [
      data.date,
      data.time,
      // Raw readings
      data.readings.dmax,
      data.readings.hd,
      data.readings.ld,
      data.readings.dmin,
      data.hdld,
      // Deviations
      data.deviations.ld,
      data.deviations.hdld,
      // Status and notes
      data.status.toUpperCase(),
      data.problems,
      data.notes
    ];
  }
}

/**
 * Utility: Get recent readings for a process
 * Can be called from the web app via GET request
 */
function getRecentReadings(process, count) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getMonthlySheetName(process);
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return [];
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }
  
  const startRow = Math.max(2, lastRow - count + 1);
  const numRows = lastRow - startRow + 1;
  const numCols = process === 'c41' ? 29 : 12;
  
  const data = sheet.getRange(startRow, 1, numRows, numCols).getValues();
  
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
      dmax: 248,
      hd: 145,
      ld: 48,
      dmin: 12
    },
    deviations: {
      ld: -2,
      hdld: 3,
      dmin: 1
    },
    hdld: 97,
    status: 'ok',
    problems: 'Process within limits',
    notes: 'Test entry from Apps Script'
  };
  
  const result = logReading(testData);
  Logger.log('Test result: ' + JSON.stringify(result));
}
