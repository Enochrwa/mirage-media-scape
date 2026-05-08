import { Router } from 'express';
import { scannerService } from '../services/scanner';

const router = Router();

router.post('/scan', async (req, res) => {
    const { directory } = req.body;
    if (!directory) {
        // If no directory, scan all existing watched folders
        scannerService.scanAll();
        return res.json({ message: 'Global scan started' });
    }

    await scannerService.addFolder(directory);
    res.json({ message: 'Folder added and scan started' });
});

export default router;
