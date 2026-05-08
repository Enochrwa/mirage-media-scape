import { Router } from 'express';
import * as scannerController from '../controllers/scannerController';

const router = Router();

router.post('/scan', scannerController.scanFolder);

export default router;
