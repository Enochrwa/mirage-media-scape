import { Router } from 'express';
import { scannerService } from '../services/scanner';

const router = Router();

router.post('/scan', async (req, res) => {
    const { directory } = req.body;
    if (!directory) {
        return res.status(400).json({ error: 'Directory path is required' });
    }

    // Run scan in background
    scannerService.scanDirectory(directory, (progress) => {
        console.log(`Scan progress: ${progress.processed}/${progress.total} - ${progress.currentFile}`);
    });

    res.json({ message: 'Scan started' });
});

export default router;
