import { Router } from 'express';
import {
  getAllTracks,
  getInstantTracks,
  getTrackById,
  streamTrack,
  searchTracks,
  getRecommendations,
  identifyTrack,
  getDuplicateCandidates,
  getTrackCover,
  getTrackThumbnail,
  getTrackThumbnailAt,
  getAlbumDetails,
  updateTrackRating,
  getTrackWaveform,
  updateTrackMetadata,
  reanalyzeTrack,
  getTrackAudioStreams,
  getTrackChapters,
} from '../controllers/tracksController.js';
import db from '../db/index.js';
import { RecommendationService } from '../services/RecommendationService.js';

const router = Router();
const recService = new RecommendationService(db);

// ── Library listing ────────────────────────────────────────────────────────
/** GET /api/tracks/instant — fast first-500 for initial render */
router.get('/instant', getInstantTracks);

/** GET /api/tracks — full library */
router.get('/', getAllTracks);

// ── Search ─────────────────────────────────────────────────────────────────
/** GET /api/tracks/search?q=... */
router.get('/search', searchTracks);

// ── Streaming ──────────────────────────────────────────────────────────────
/** GET /api/tracks/stream?path=... */
router.get('/stream', streamTrack);

// ── Duplicates ─────────────────────────────────────────────────────────────
/** GET /api/tracks/duplicates */
router.get('/duplicates', getDuplicateCandidates);

// ── Mood recommendations ───────────────────────────────────────────────────
/** GET /api/tracks/recommendations/mood?energy=&bpm=&limit= */
router.get('/recommendations/mood', async (req, res) => {
  const energy = parseFloat(req.query.energy as string) || 0.5;
  const bpm = parseFloat(req.query.bpm as string) || 120;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const recs = await recService.recommendByMood({ energy, bpm, limit });
  res.json({ data: recs });
});

// ── Per-track routes ───────────────────────────────────────────────────────
/** GET /api/tracks/:id */
router.get('/:id', getTrackById);

/** PATCH /api/tracks/:id/rating */
router.patch('/:id/rating', updateTrackRating);

/** PATCH /api/tracks/:id/metadata */
router.patch('/:id/metadata', updateTrackMetadata);

/** POST /api/tracks/:id/reanalyze */
router.post('/:id/reanalyze', reanalyzeTrack);

/** GET /api/tracks/:id/cover */
router.get('/:id/cover', getTrackCover);

/** GET /api/tracks/:id/thumbnail */
router.get('/:id/thumbnail', getTrackThumbnail);

/** GET /api/tracks/:id/thumbnail-at?at=... */
router.get('/:id/thumbnail-at', getTrackThumbnailAt);

/** GET /api/tracks/:id/waveform */
router.get('/:id/waveform', getTrackWaveform);

/** GET /api/tracks/:id/recommendations */
router.get('/:id/recommendations', getRecommendations);

/** GET /api/tracks/:id/audio-streams */
router.get('/:id/audio-streams', getTrackAudioStreams);

/** GET /api/tracks/:id/chapters */
router.get('/:id/chapters', getTrackChapters);

/** POST /api/tracks/:id/identify */
router.post('/:id/identify', identifyTrack);

/** GET /api/tracks/album/:id */
router.get('/album/:id', getAlbumDetails);

export default router;
