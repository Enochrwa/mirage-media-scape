import { Router } from 'express';
import * as scannerController from '../controllers/scannerController';
import { scannerService } from '../services/scanner';
import { Server } from 'socket.io';

const router = Router();

export const setIo = (io: Server) => {
  scannerService.setIo(io);
};

router.post('/scan', scannerController.scanFolder);

export default router;
