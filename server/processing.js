// Data-processing logic for meeting rows, ported unchanged from the
// original Base44 backend function (processGoogleSheets).

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
            const [, month, year] = actualDate.split('/').map(Number);
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
export function loadDegreeMapping(values) {
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
export function processData(rows, degreeMapping) {
    const expandedRows = [];

    for (const row of rows) {
        const [subject, , startDate, endDate, , categories] = row;

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

export const OUTPUT_HEADERS = [
    'start_date', 'end_date', 'categories', 'subject', 'Phone',
    'Month', 'Year', 'Meeting Type', 'Consultant',
    'Degree (Normalized)', 'first name'
];
