import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { google } from 'npm:googleapis@140.0.0';

const SPREADSHEET_ID = '1Vv0wwcWg9buz6myZHvH3BRORszKVPvtvA-_iHn-SVB0';
const MAIN_WORKSHEET_NAME = 'Sheet1';
const LIST_WORKSHEET_NAME = 'list';
const NEW_WORKSHEET_NAME = 'new';
const CONSULTANTS = ['עפר', 'טליה', 'סהר', 'יעקב', 'דניאל', 'רז'];

// Date extraction pattern
const DATE_PATTERN = /(\b\d{2}\/\d{2}\/\d{4}\b)/;

// Extract actual date from string
function extractActualDate(dateString) {
    if (!dateString || dateString.trim() === '' || dateString.trim() === 'התחלה') {
        return null;
    }
    const match = DATE_PATTERN.exec(String(dateString));
    return match ? match[1] : null;
}

// Extract month and year from date string
function extractMonthYear(startDate) {
    try {
        const actualDate = extractActualDate(startDate);
        if (actualDate) {
            const [day, month, year] = actualDate.split('/').map(Number);
            return { month, year };
        }
    } catch (e) {
        console.warn(`Failed to parse date: ${startDate}`, e);
    }
    return { month: null, year: null };
}

// Extract phone numbers
function extractPhoneNumbers(subject) {
    const pattern = /(\b\d{3}-?\d{3}-?\d{4}\b)/g;
    const phones = String(subject).match(pattern) || [];
    return phones.map(formatPhone);
}

// Format phone number
function formatPhone(phone) {
    phone = String(phone).replace(/--/g, '-');
    if (!phone.startsWith('0')) {
        phone = '0' + phone;
    }
    return `${phone.slice(0, 3)}-${phone.slice(3).replace(/-/g, '')}`;
}

// Determine meeting type
function determineMeetingType(categories, subject) {
    const cats = String(categories || '');
    const subj = String(subject || '');
    
    if (cats.includes('אונליין')) {
        return 'פגישת אונליין';
    } else if (subj.includes('נרשם') || subj.includes('נרשמה')) {
        return 'נרשם/ה';
    } else if (subj.includes('לא הגיעה')) {
        return 'לא הגיעה';
    }
    return 'פרונטלית';
}

// Extract consultant
function extractConsultant(categories) {
    const cats = String(categories || '');
    return CONSULTANTS.find(consultant => cats.includes(consultant)) || null;
}

// Normalize degree
function normalizeDegree(subject, degreeMapping) {
    const subjectLower = String(subject || '').toLowerCase();
    
    for (const [key, values] of Object.entries(degreeMapping)) {
        const subkeys = key.split(',').map(s => s.trim());
        
        for (const subkey of subkeys) {
            if (subkey.includes('+')) {
                const parts = subkey.split('+');
                if (parts.every(part => subjectLower.includes(part.toLowerCase()))) {
                    return values.join(', ');
                }
            } else if (subjectLower.includes(subkey.toLowerCase())) {
                return values.join(', ');
            }
        }
    }
    
    return 'no match';
}

// Load degree mapping from worksheet
function loadDegreeMapping(values) {
    const headers = values[0];
    const rows = values.slice(1);
    
    const mapping = {};
    
    rows.forEach(row => {
        const listOfStrings = row[0]; // 'list of strings' column
        const degree = row[1]; // 'חוג' column
        
        if (listOfStrings && degree) {
            if (!mapping[listOfStrings]) {
                mapping[listOfStrings] = [];
            }
            mapping[listOfStrings].push(degree);
        }
    });
    
    return mapping;
}

// Process data
function processData(rows, degreeMapping) {
    const expandedRows = [];
    
    for (const row of rows) {
        const [subject, location, startDate, endDate, , categories] = row;
        
        // Skip invalid rows
        if (!startDate || !endDate || 
            String(startDate).includes('ללא') || 
            String(endDate).includes('ללא')) {
            continue;
        }
        
        if (!extractActualDate(startDate) || !extractActualDate(endDate)) {
            continue;
        }
        
        let consultant = extractConsultant(categories);
        const phoneNumbers = extractPhoneNumbers(subject);
        const phones = phoneNumbers.length > 0 ? phoneNumbers : [null];
        const { month, year } = extractMonthYear(startDate);
        let meetingType = determineMeetingType(categories, subject);
        
        if (consultant === null) {
            meetingType = 'לא הגיעה';
            consultant = 'לא משויך';
        }
        
        const degreeNormalized = normalizeDegree(subject, degreeMapping);
        
        if (subject.includes('הגשת מועמדות')) {
            meetingType = 'הגשת מועמדות';
        }
        
        // Extract first name
        const firstName = subject && String(subject).trim() 
            ? String(subject).trim().split(/\s+/)[0] 
            : null;
        
        for (const phone of phones) {
            expandedRows.push({
                'start_date': startDate,
                'end_date': endDate,
                'categories': categories,
                'subject': subject,
                'Phone': phone,
                'Month': month,
                'Year': year,
                'Meeting Type': meetingType,
                'Consultant': consultant,
                'Degree (Normalized)': degreeNormalized,
                'first name': firstName
            });
        }
    }
    
    return expandedRows;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Get Google Sheets access token
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
        
        // Initialize Google Sheets API
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        const sheets = google.sheets({ version: 'v4', auth });
        
        console.log('Using spreadsheet ID:', SPREADSHEET_ID);
        const spreadsheetId = SPREADSHEET_ID;
        
        // Read main worksheet
        const mainData = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${MAIN_WORKSHEET_NAME}!A:F`
        });
        
        const mainValues = mainData.data.values;
        if (!mainValues || mainValues.length < 1) {
            return Response.json({ 
                error: 'אין נתונים בגיליון הראשי' 
            }, { status: 400 });
        }
        
        // Work with all rows - no header dependency
        const dataRows = mainValues;
        
        console.log(`Loaded ${dataRows.length} rows from main sheet`);
        
        // Read list worksheet for degree mapping
        const listData = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${LIST_WORKSHEET_NAME}!A:B`
        });
        
        const listValues = listData.data.values;
        if (!listValues || listValues.length < 1) {
            return Response.json({ 
                error: 'אין נתוני מיפוי בגיליון list' 
            }, { status: 400 });
        }
        
        // Load mapping from all rows (will handle headers automatically)
        const degreeMapping = loadDegreeMapping(listValues);
        console.log('Loaded degree mapping');
        
        // Process data
        const processedData = processData(dataRows, degreeMapping);
        console.log(`Processed ${processedData.length} rows`);
        
        // Prepare data for upload
        const outputHeaders = [
            'start_date', 'end_date', 'categories', 'subject', 'Phone',
            'Month', 'Year', 'Meeting Type', 'Consultant', 
            'Degree (Normalized)', 'first name'
        ];
        
        const outputRows = processedData.map(row => 
            outputHeaders.map(header => row[header] || '')
        );
        
        const uploadData = [outputHeaders, ...outputRows];
        
        // Clear and update new worksheet
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${NEW_WORKSHEET_NAME}!A:Z`
        });
        
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${NEW_WORKSHEET_NAME}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
                values: uploadData
            }
        });
        
        console.log('Data uploaded successfully');
        
        return Response.json({
            success: true,
            message: 'העיבוד הושלם בהצלחה',
            stats: {
                inputRows: dataRows.length,
                outputRows: processedData.length,
                spreadsheetId
            }
        });
        
    } catch (error) {
        console.error('Error:', error);
        return Response.json({ 
            error: error.message,
            details: error.stack 
        }, { status: 500 });
    }
});