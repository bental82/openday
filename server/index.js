// Local/self-hosted server: exposes the processing API and serves the
// built frontend. On Vercel the same logic runs as a serverless
// function instead (api/process-meetings.js).
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { processMeetings } from './processMeetings.js';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());

app.post('/api/process-meetings', async (req, res) => {
    try {
        res.json(await processMeetings());
    } catch (error) {
        console.error('Error:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
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
