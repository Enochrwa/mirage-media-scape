import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import tracksRouter from './routes/tracks';
import scannerRouter, { setIo } from './routes/scanner';
import playlistsRouter from './routes/playlists';
import statsRouter from './routes/stats';
import radioRouter from './routes/radio';
import subtitlesRouter from './routes/subtitles';

import { LocalSyncServer } from './services/LocalSyncServer';
import { RemoteControlServer } from './services/RemoteControlServer';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*' }
});

setIo(io);

app.use(cors());
app.use(express.json());

// Initialize services
new LocalSyncServer(8766);
new RemoteControlServer(8765);

// Routes
app.use('/api/tracks', tracksRouter);
app.use('/api/scanner', scannerRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/radio', radioRouter);
app.use('/api/subtitles', subtitlesRouter);

// Serve covers
app.use('/api/covers', express.static(path.join(__dirname, '../cache/covers')));

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    console.log(`Sonic Server running on port ${PORT}`);
});
