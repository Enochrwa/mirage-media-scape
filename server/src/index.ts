import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import tracksRouter from './routes/tracks.js';
import scannerRouter, { scannerService } from './routes/scanner.js';
import { analysisService } from './services/AnalysisService.js';
import playlistsRouter from './routes/playlists.js';
import statsRouter from './routes/stats.js';
import radioRouter from './routes/radio.js';
import subtitlesRouter from './routes/subtitles.js';
import aidjRouter from './routes/ai-dj.js';
import podcastsRouter from './routes/podcasts.js';
import eqPresetsRouter from './routes/eq-presets.js';
import settingsRouter from './routes/settings.js';
import downloadsRouter from './routes/downloads.js';
import maintenanceRouter from './routes/maintenance.js';
import streamRouter from './routes/stream.js';
import authRouter from './routes/auth.js';
import uploadRouter from './routes/upload.js';
import socialRouter from './routes/social.js';
import coversRouter from './routes/covers.js';

import { LocalSyncServer } from './services/LocalSyncServer.js';
import { RemoteControlServer } from './services/RemoteControlServer.js';
import { refreshLibraryWatcherPaths, setLibraryWatcherIo } from './services/LibraryWatcher.js';

dotenv.config();


const app = express();
const httpServer = createServer(app);

// CORS configuration from environment
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'];

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

scannerService.setIo(io);
analysisService.setIo(io);
setLibraryWatcherIo(io);
refreshLibraryWatcherPaths();

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

// Apply rate limiting to all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    data: { message: 'Too many requests from this IP, please try again after 15 minutes' },
  },
});

app.use('/api/', limiter);

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
app.use('/api/ai-dj', aidjRouter);
app.use('/api/podcasts', podcastsRouter);
app.use('/api/eq-presets', eqPresetsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/downloads', downloadsRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/stream', streamRouter);
app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/social', socialRouter);

// Serve covers
app.use('/api/covers', coversRouter);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Zovyra Server running on port ${PORT}`);
});
