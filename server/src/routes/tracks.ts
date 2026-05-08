import { Router } from 'express';
import * as tracksController from '../controllers/tracksController';

const router = Router();

router.get('/', tracksController.getAllTracks);
router.get('/stream', tracksController.streamTrack);
router.get('/search', tracksController.searchTracks);
router.get('/duplicates/candidates', tracksController.getDuplicateCandidates);
router.get('/:id', tracksController.getTrackById);
router.get('/:id/recommendations', tracksController.getRecommendations);
router.get('/:id/waveform', tracksController.getTrackWaveform);
router.post('/:id/identify', tracksController.identifyTrack);

export default router;
