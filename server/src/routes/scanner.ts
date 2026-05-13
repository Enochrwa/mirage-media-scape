import { Router } from 'express';
import { scannerService, ScannerService } from '../services/scanner';

const router = Router();
export { scannerService };

router.post('/scan', async (req, res) => {
  await scannerService.scanAll();
  res.json({ data: { message: 'Scan started' } });
});

router.get('/stats', async (req, res) => {
  const stats = await ScannerService.getLibraryStats();
  res.json({ data: stats });
});

export default router;
