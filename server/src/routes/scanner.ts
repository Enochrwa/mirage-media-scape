import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as scannerController from '../controllers/scannerController';
import { scannerService } from '../services/scanner';
import { Server } from 'socket.io';

const router = Router();

const scannerRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const scannerWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

export const setIo = (io: Server) => {
  scannerService.setIo(io);
};

router.get('/bootstrap', scannerRateLimiter, scannerController.getBootstrap);
router.post('/onboarding/home', scannerWriteLimiter, scannerController.postOnboardingHome);
router.post('/onboarding/choose-folder', scannerWriteLimiter, scannerController.postOnboardingChooseFolder);
router.post('/onboarding/dismiss', scannerWriteLimiter, scannerController.postOnboardingDismiss);
router.post('/scan', scannerWriteLimiter, scannerController.scanFolder);

export default router;
