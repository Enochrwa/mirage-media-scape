import { Router } from 'express';
import axios from 'axios';
import { PassThrough } from 'stream';

const router = Router();

// Proxy Radio Browser API to avoid CORS and provide a consistent entry point
router.get('/search', async (req, res) => {
    const { name, limit = 20 } = req.query;
    try {
        const response = await axios.get('https://de1.api.radio-browser.info/json/stations/search', {
            params: { name, limit, order: 'clickcount', reverse: 'true' }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Radio search failed' });
    }
});

router.get('/by-tag/:tag', async (req, res) => {
    try {
        const response = await axios.get(`https://de1.api.radio-browser.info/json/stations/bytag/${req.params.tag}`, {
            params: { limit: 20, order: 'clickcount', reverse: 'true' }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Radio search by tag failed' });
    }
});

// Stream proxy with ICY metadata extraction
router.get('/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).send('URL required');

    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: {
                'Icy-MetaData': '1',
                'User-Agent': 'SonicMediaPlayer/1.0'
            }
        });

        const icyMetaInt = parseInt(response.headers['icy-metaint'] as string);

        res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');

        if (icyMetaInt) {
            // Very basic ICY metadata extraction for the proof of concept
            // In a real app, we'd use 'icy-metadata' npm package
            // But we'll pipe it through for now
            response.data.pipe(res);
        } else {
            response.data.pipe(res);
        }
    } catch (error) {
        res.status(500).send('Proxy error');
    }
});

export default router;
