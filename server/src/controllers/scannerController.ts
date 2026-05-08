import { Request, Response } from 'express';
import { scannerService } from '../services/scanner';

export const scanFolder = async (req: Request, res: Response) => {
    const { directory } = req.body;
    if (!directory) {
        scannerService.scanAll();
        return res.json({ message: 'Global scan started' });
    }

    await scannerService.addFolder(directory);
    res.json({ message: 'Folder added and scan started' });
};
