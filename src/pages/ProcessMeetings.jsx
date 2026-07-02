import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, PlayCircle, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';

export default function ProcessMeetings() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleProcess = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/process-meetings', { method: 'POST' });
            // The response may not be JSON when the API server is unreachable
            // (dev proxy error, reverse-proxy 502 page)
            const data = await response.json().catch(() => null);

            if (!response.ok || !data || data.error) {
                setError(data?.error || `שגיאה בעיבוד הנתונים (HTTP ${response.status})`);
            } else {
                setResult(data);
            }
        } catch (err) {
            setError(err.message || 'שגיאה בעיבוד הנתונים');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6" dir="rtl">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        עיבוד פגישות
                    </h1>
                    <p className="text-gray-600">
                        מעבד נתונים מגיליון Google Sheets "Meetings4"
                    </p>
                </div>

                <Card className="shadow-lg">
                    <CardHeader className="bg-gradient-to-l from-blue-600 to-indigo-600 text-white rounded-t-lg">
                        <div className="flex items-center gap-3">
                            <FileSpreadsheet className="w-8 h-8" />
                            <div>
                                <CardTitle className="text-2xl">מעבד גיליון Google Sheets</CardTitle>
                                <CardDescription className="text-blue-100 mt-1">
                                    לוקח נתונים מהגיליון, מעבד אותם ושומר בגיליון "new"
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="p-8">
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h3 className="font-semibold text-blue-900 mb-2">מה הפונקציה עושה:</h3>
                                <ul className="space-y-2 text-blue-800 text-sm">
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-1">•</span>
                                        <span>קורא נתונים מגיליון "Sheet1" ו-"list"</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-1">•</span>
                                        <span>מחלץ תאריכים, מספרי טלפון ושמות</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-1">•</span>
                                        <span>מזהה יועצים וסוגי פגישות</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-1">•</span>
                                        <span>מנרמל חוגים לפי המיפוי</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-1">•</span>
                                        <span>שומר את התוצאות בגיליון "new"</span>
                                    </li>
                                </ul>
                            </div>

                            <Button
                                onClick={handleProcess}
                                disabled={loading}
                                className="w-full bg-gradient-to-l from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-14 text-lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                                        מעבד נתונים...
                                    </>
                                ) : (
                                    <>
                                        <PlayCircle className="w-5 h-5 ml-2" />
                                        הפעל עיבוד
                                    </>
                                )}
                            </Button>

                            {error && (
                                <Alert variant="destructive" className="border-red-300 bg-red-50">
                                    <AlertCircle className="h-5 w-5" />
                                    <AlertDescription className="text-red-800 font-medium">
                                        {error}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {result && (
                                <Alert className="border-green-300 bg-green-50">
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    <AlertDescription>
                                        <div className="text-green-800">
                                            <p className="font-semibold mb-2">{result.message}</p>
                                            {result.stats && (
                                                <div className="space-y-1 text-sm">
                                                    <p>• שורות קלט: {result.stats.inputRows}</p>
                                                    <p>• שורות פלט: {result.stats.outputRows}</p>
                                                    <p className="mt-2 text-xs text-green-700">
                                                        הנתונים נשמרו בגיליון "new"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="mt-6 text-center text-sm text-gray-600">
                    <p>ID גיליון: <span className="font-mono text-xs">1Vv0wwcWg9buz6myZHvH3BRORszKVPvtvA-_iHn-SVB0</span></p>
                    <p className="mt-1">קוראים מ: Sheet1, list | כותבים ל: new</p>
                </div>
            </div>
        </div>
    );
}