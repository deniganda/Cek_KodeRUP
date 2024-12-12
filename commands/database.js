const { google } = require('googleapis');
const logger = console;

// Set up authentication
const auth = new google.auth.GoogleAuth({
    keyFile: './key.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

// Set up the Google Sheets API client
const sheets = google.sheets({ version: 'v4', auth });

// Set up the spreadsheet ID and sheet names
const spreadsheetId = '1y7yvylJYuqZCLWSX22CGXDDS5YIZyFWKXIBieSDOba0';
const sheetNames = ['PenyediaLM', 'PenyediaBR', 'AutoPenyedia'];
const columnLetters = ['H', 'H', 'A'];

// Function to look up a value in the spreadsheet
async function checkDataRup(kodeRup) {
  try {
    logger.info(`Checking data RUP for kodeRup: ${kodeRup}`);

    // Loop through each sheet and column
    for (let i = 0; i < sheetNames.length; i++) {
      const sheetName = sheetNames[i];
      const columnLetter = columnLetters[i];

      // Set up the range to search
      const range = `${sheetName}!${columnLetter}1:${columnLetter}`;

      logger.info(`Searching for kodeRup in sheet: ${sheetName}, column: ${columnLetter}`);

      // Get the values from the sheet
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      logger.info(`Received response from Google Sheets API`);

      // Loop through each value and check if it matches the kodeRup
      for (const row of response.data.values) {
        if (row[0] === kodeRup) {
              logger.info(`Found kodeRup in sheet: ${sheetName}, column: ${columnLetter}`);     
              return `<b>Kode:</b> <blockquote>${kodeRup}</blockquote>\n ditemukan pada <b>${sheetName}</b>`;        
          }        
        }
    }

    logger.info(`KodeRup not found in spreadsheet`);
    return `<b>Kode:</b> <blockquote>${kodeRup}</blockquote>\ntidak ditemukan pada <b>Database</b>`;
  } catch (error) {
    logger.error(`Error checking data RUP: ${error.message}`);
    return false;
  }
}

module.exports = { checkDataRup };