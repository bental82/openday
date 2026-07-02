// Standalone API server: replaces the Base44 backend function with a
// direct Google Sheets integration authenticated via a Google service
// account (see README.md for setup).
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { loadDegreeMapping, processData, OUTPUT_HEADERS } from './processing.js';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1Vv0wwcWg9buz6myZHvH3BRORszKVPvtvA-_iHn-SVB0';
const MAIN_WORKSHEET_NAME = process.env.MAIN_WORKSHEET_NAME || 'Sheet1';
const LIST_WORKSHEET_NAME = process.env.LIST_WORKSHEET_NAME || 'list';
const NEW_WORKSHEET_NAME = process.env.NEW_WORKSHEET_NAME || 'new';
const PORT = process.env.PORT || 3001;

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function createGoogleAuth() {
    // Option 1: full service-account JSON in an env var (good for cloud hosts)
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (rawKey) {
        let credentials;
        try {
            credentials = JSON.parse(rawKey);
        } catch {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
        }
        return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
    }
    // Option 2: GOOGLE_APPLICATION_CREDENTIALS points to a key file,
    // or the host provides Application Default Credentials.
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT) {
        return new google.auth.GoogleAuth({ scopes: SCOPES });
    }
    throw new Error(
        'לא הוגדרו פרטי גישה ל-Google. יש להגדיר GOOGLE_SERVICE_ACCOUNT_KEY או GOOGLE_APPLICATION_CREDENTIALS (ראו README.md)'
    );
}

const app = express();
app.use(express.json());

app.post('/api/process-meetings', async (req, res) => {
    try {
        const auth = createGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });

        console.log('Using spreadsheet ID:', SPREADSHEET_ID);

        // Read main worksheet
        const mainData = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${MAIN_WORKSHEET_NAME}!A:F`
        });

        const mainValues = mainData.data.values;
        if (!mainValues || mainValues.length < 1) {
            return res.status(400).json({ error: 'אין נתונים בגיליון הראשי' });
        }

        console.log(`Loaded ${mainValues.length} rows from main sheet`);

        // Read list worksheet for degree mapping
        const listData = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${LIST_WORKSHEET_NAME}!A:B`
        });

        const listValues = listData.data.values;
        if (!listValues || listValues.length < 1) {
            return res.status(400).json({ error: 'אין נתוני מיפוי בגיליון list' });
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
            spreadsheetId: SPREADSHEET_ID,
            range: `${NEW_WORKSHEET_NAME}!A:Z`
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${NEW_WORKSHEET_NAME}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
                values: uploadData
            }
        });

        console.log('Data uploaded successfully');

        res.json({
            success: true,
            message: 'העיבוד הושלם בהצלחה',
            stats: {
                inputRows: mainValues.length,
                outputRows: processedData.length,
                spreadsheetId: SPREADSHEET_ID
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// In production, serve the built frontend from dist/
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.use((req, res, next) => {
        // Only fall back to index.html for page navigations — let missing
        // files (anything with an extension) and API paths 404 properly
        if (req.method !== 'GET' || req.path.startsWith('/api/') || path.extname(req.path) !== '') {
            return next();
        }
        res.sendFile(path.join(distDir, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Meeting Manager server listening on http://localhost:${PORT}`);
});
