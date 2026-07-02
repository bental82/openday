# Meeting Manager — עיבוד פגישות

אפליקציה לעיבוד נתוני פגישות מ-Google Sheets: קוראת נתונים מהגיליונות `Sheet1` ו-`list`, מחלצת תאריכים, טלפונים, יועצים וסוגי פגישות, מנרמלת חוגים לפי מיפוי, וכותבת את התוצאה לגיליון `new`.

האפליקציה **עצמאית לחלוטין** — ללא תלות ב-Base44. היא מורכבת מ:

- **פרונטאנד**: React + Vite (תיקיית `src/`)
- **לוגיקת עיבוד משותפת**: `server/processMeetings.js` — ניגשת ל-Google Sheets באמצעות Service Account
- **שרת מקומי**: Express (`server/index.js`) — לפיתוח ולאירוח עצמי
- **Vercel**: אותה לוגיקה כ-Serverless Function (`api/process-meetings.js`)

## דרישות מקדימות

- Node.js 20 ומעלה
- חשבון Google Cloud עם גישה לגיליון

## חיבור ל-Google Sheets (חד־פעמי)

1. היכנסו ל-[Google Cloud Console](https://console.cloud.google.com/) וצרו פרויקט (או בחרו קיים).
2. הפעילו את **Google Sheets API**: APIs & Services → Library → חפשו "Google Sheets API" → Enable.
3. צרו **Service Account**: APIs & Services → Credentials → Create Credentials → Service account. אין צורך בהרשאות (Roles) מיוחדות.
4. צרו מפתח: בתוך ה-Service Account → Keys → Add Key → Create new key → JSON. שמרו את הקובץ.
5. **שתפו את הגיליון** עם כתובת המייל של ה-Service Account (מופיעה בשדה `client_email` בקובץ ה-JSON, למשל `xxx@yyy.iam.gserviceaccount.com`) עם הרשאת **Editor**.

## הגדרת סביבה

צרו קובץ `.env` בתיקיית הפרויקט (ראו `.env.example`):

```
# אחת משתי האפשרויות:
GOOGLE_APPLICATION_CREDENTIALS=./google-service-account.json
# או:
# GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# אופציונלי (יש ברירות מחדל):
# SPREADSHEET_ID=1Vv0wwcWg9buz6myZHvH3BRORszKVPvtvA-_iHn-SVB0
# PORT=3001
```

> קבצי `.env` ומפתחות JSON לא נכנסים ל-git (מוחרגים ב-`.gitignore`). אל תעלו אותם לריפו.

## הרצה מקומית (פיתוח)

```bash
npm install
npm run dev
```

הפקודה מריצה במקביל את שרת ה-API (פורט 3001) ואת Vite (פורט 5173). גשו ל-http://localhost:5173.

## פריסה ב-Vercel (מומלץ)

1. ב-[Vercel](https://vercel.com) בחרו **Add New → Project** וייבאו את הריפו מ-GitHub. Vercel מזהה את Vite אוטומטית — אין צורך לשנות הגדרות build.
2. לפני ה-Deploy (או אחריו, תחת Settings → Environment Variables) הוסיפו משתנה סביבה:
   - **Key**: `GOOGLE_SERVICE_ACCOUNT_KEY`
   - **Value**: כל תוכן קובץ ה-JSON של ה-Service Account, מודבק כמו שהוא
   - סמנו אותו כ-**Sensitive**
3. אופציונלי: `SPREADSHEET_ID`, `MAIN_WORKSHEET_NAME`, `LIST_WORKSHEET_NAME`, `NEW_WORKSHEET_NAME` (יש ברירות מחדל).
4. Deploy. ה-API רץ כ-Serverless Function תחת `/api/process-meetings` והפרונטאנד מוגש סטטית.

## הרצה בפרודקשן (אירוח עצמי)

```bash
npm install
npm run build
npm start
```

השרת מגיש גם את ה-API וגם את הפרונטאנד הבנוי מ-`dist/` על פורט 3001 (או `PORT`).

## שימו לב — אין אימות משתמשים

לאחר הניתוק מ-Base44 הוסר גם מנגנון ההתחברות. כל מי שיש לו גישה לכתובת האפליקציה יכול להפעיל את העיבוד. אם מפרסמים את האפליקציה לאינטרנט, מומלץ להגן עליה (למשל Basic Auth בשרת, Cloudflare Access, או הרצה ברשת פנימית בלבד).

## API

| Method | Path | תיאור |
|--------|------|-------|
| POST | `/api/process-meetings` | מריץ את עיבוד הגיליון ומחזיר סטטיסטיקות |
