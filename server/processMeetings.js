// Shared orchestration: Google auth + read/process/write of the
// spreadsheet. Used by both the local Express server (server/index.js)
// and the Vercel serverless function (api/process-meetings.js).
import { GoogleAuth } from 'google-auth-library';
import { sheets as createSheetsClient } from '@googleapis/sheets';
import { loadDegreeMapping, processData, OUTPUT_HEADERS } from './processing.js';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export class ProcessingError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
    }
}

function createGoogleAuth() {
    // Option 1: full service-account JSON in an env var (Vercel and other cloud hosts)
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (rawKey) {
        let credentials;
        try {
            credentials = JSON.parse(rawKey);
        } catch {
            throw new ProcessingError('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
        }
        return new GoogleAuth({ credentials, scopes: SCOPES });
    }
    // Option 2: GOOGLE_APPLICATION_CREDENTIALS points to a key file,
    // or the host provides Application Default Credentials.
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT) {
        return new GoogleAuth({ scopes: SCOPES });
    }
    throw new ProcessingError(
        'לא הוגדרו פרטי גישה ל-Google. יש להגדיר GOOGLE_SERVICE_ACCOUNT_KEY או GOOGLE_APPLICATION_CREDENTIALS (ראו README.md)'
    );
}

export async function processMeetings() {
    const spreadsheetId = process.env.SPREADSHEET_ID || '1Vv0wwcWg9buz6myZHvH3BRORszKVPvtvA-_iHn-SVB0';
    const mainWorksheet = process.env.MAIN_WORKSHEET_NAME || 'Sheet1';
    const listWorksheet = process.env.LIST_WORKSHEET_NAME || 'list';
    const newWorksheet = process.env.NEW_WORKSHEET_NAME || 'new';

    const auth = createGoogleAuth();
    const sheets = createSheetsClient({ version: 'v4', auth });

    console.log('Using spreadsheet ID:', spreadsheetId);

    // Read main worksheet
    const mainData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${mainWorksheet}!A:F`
    });

    const mainValues = mainData.data.values;
    if (!mainValues || mainValues.length < 1) {
        throw new ProcessingError('אין נתונים בגיליון הראשי', 400);
    }

    console.log(`Loaded ${mainValues.length} rows from main sheet`);

    // Read list worksheet for degree mapping
    const listData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${listWorksheet}!A:B`
    });

    const listValues = listData.data.values;
    if (!listValues || listValues.length < 1) {
        throw new ProcessingError('אין נתוני מיפוי בגיליון list', 400);
    }

    const degreeMapping = loadDegreeMapping(listValues);
    console.log('Loaded degree mapping');

    const processedData = processData(mainValues, degreeMapping);
    console.log(`Processed ${processedData.length} rows`);

    const outputRows = processedData.map(row =>
        OUTPUT_HEADERS.map(header => row[header] || '')
    );
    const uploadData = [OUTPUT_HEADERS, ...outputRows];

    // Clear and update new worksheet
    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${newWorksheet}!A:Z`
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${newWorksheet}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
            values: uploadData
        }
    });

    console.log('Data uploaded successfully');

    return {
        success: true,
        message: 'העיבוד הושלם בהצלחה',
        stats: {
            inputRows: mainValues.length,
            outputRows: processedData.length,
            spreadsheetId
        }
    };
}
