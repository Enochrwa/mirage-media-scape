import { Router } from 'express';
import * as scannerController from '../controllers/scannerController';
import { scannerService } from '../services/scanner';
import { Server } from 'socket.io';

const router = Router();

export const setIo = (io: Server) => {
  scannerService.setIo(io);
};

router.get('/bootstrap', scannerController.getBootstrap);
router.post('/onboarding/home', scannerController.postOnboardingHome);
router.post('/onboarding/choose-folder', scannerController.postOnboardingChooseFolder);
router.post('/onboarding/dismiss', scannerController.postOnboardingDismiss);
router.post('/scan', scannerController.scanFolder);

export default router;
