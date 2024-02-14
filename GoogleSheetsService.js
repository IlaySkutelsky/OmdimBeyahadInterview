const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

const SHEET_ID = process.env.SHEET_ID

/***********************************************************************************************
*
* All Authorization-realted function are from https://developers.google.com/sheets/api/quickstart/nodejs
*
************************************************************************************************/

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

// ---------- Custom functions start here ----------

async function getEvents(auth) {
  const sheets = google.sheets({version: 'v4', auth});
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'פעילים ואירועים!A2:A1000',
  });
  const rows = res.data.values;
  return rows
}

// Get all values in the sheet
async function getEventsAndActivists(auth) {
  const sheets = google.sheets({version: 'v4', auth});
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'פעילים ואירועים!A2:AB1000',
  });
  const rows = res.data.values;
  return rows
}

// Append a new event to the list
async function addEvent(auth, eventName, date) {
  const sheets = google.sheets({version: 'v4', auth});
  return res = sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'פעילים ואירועים!A:B',
    valueInputOption: 'RAW',
    resource: {
      values: [[eventName, date]]
    }
  });
}

// Add list of names by event name
async function addNames(auth, names, eventName) {
  // Get row of the event
  let eventsAndActivists = await getEventsAndActivists(auth)
  events = eventsAndActivists.map(row => row[0]).flat()
  let eventIndex = events.indexOf(eventName)
  if (eventIndex < 0) return

  // Get column (if no names yet use 'C', otherwise append after last name)
  let newNamesIndex = eventsAndActivists[eventIndex].length
  let newNamesCol
  if (newNamesIndex <= 2) newNamesCol = 'C'
  else newNamesCol = colName(newNamesIndex)
  let range = `פעילים ואירועים!${newNamesCol}${eventIndex+2}:AB${eventIndex+2}`

  const sheets = google.sheets({version: 'v4', auth});
  let res = sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'RAW',
    resource: {
      values: [names]
    }
  });
  return res
}

// Helper function, converts number of column to letters ( example 56 => 'be' )
function colName(n) {
    var ordA = 'a'.charCodeAt(0);
    var ordZ = 'z'.charCodeAt(0);
    var len = ordZ - ordA + 1;
  
    var s = "";
    while(n >= 0) {
        s = String.fromCharCode(n % len + ordA) + s;
        n = Math.floor(n / len) - 1;
    }
    return s;
}

module.exports = {
    authorize,
    getEvents,
    addEvent,
    addNames
}

