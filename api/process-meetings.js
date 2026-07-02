// Vercel serverless function — same endpoint the Express server exposes
// locally, backed by the shared implementation in server/processMeetings.js.
import { processMeetings } from '../server/processMeetings.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        res.status(200).json(await processMeetings());
    } catch (error) {
        console.error('Error:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
}
