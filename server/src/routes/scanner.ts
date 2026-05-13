import { Router } from 'express';
import { scannerService } from '../services/scanner';

const router = Router();

router.post('/scan', async (req, res) => {
  await scannerService.scanAll();
  res.json({ data: { message: 'Scan started' } });
});

router.get('/stats', async (req, res) => {
  const stats = await scannerService.getLibraryStats();
  res.json({ data: stats });
});

export default router;
