import { Router } from 'express';
import * as playlistsController from '../controllers/playlistsController';

const router = Router();

router.get('/', playlistsController.getAllSmartPlaylists);
router.post('/', playlistsController.createSmartPlaylist);
router.get('/:id/tracks', playlistsController.getSmartPlaylistTracks);
router.post('/preview', playlistsController.previewSmartPlaylist);
router.delete('/:id', playlistsController.deleteSmartPlaylist);

export default router;
