import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as tracksController from '../controllers/tracksController';

const router = Router();

const tracksRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/instant', tracksRateLimiter, tracksController.getInstantTracks);
router.get('/', tracksRateLimiter, tracksController.getAllTracks);
router.get('/stream', tracksRateLimiter, tracksController.streamTrack);
router.get('/search', tracksRateLimiter, tracksController.searchTracks);
router.get('/duplicates/candidates', tracksRateLimiter, tracksController.getDuplicateCandidates);
router.get('/cover/:id', tracksRateLimiter, tracksController.getTrackCover);
router.get('/thumbnail/:id', tracksRateLimiter, tracksController.getTrackThumbnail);
router.get('/:id', tracksRateLimiter, tracksController.getTrackById);
router.get('/:id/recommendations', tracksRateLimiter, tracksController.getRecommendations);
router.get('/:id/waveform', tracksRateLimiter, tracksController.getTrackWaveform);
router.post('/:id/identify', tracksRateLimiter, tracksController.identifyTrack);

export default router;
