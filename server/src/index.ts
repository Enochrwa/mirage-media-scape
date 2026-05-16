import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import tracksRouter from './routes/tracks.js';
import scannerRouter, { scannerService } from './routes/scanner.js';
import playlistsRouter from './routes/playlists.js';
import statsRouter from './routes/stats.js';
import radioRouter from './routes/radio.js';
import subtitlesRouter from './routes/subtitles.js';
import aidjRouter from './routes/ai-dj.js';
import podcastsRouter from './routes/podcasts.js';
import downloadsRouter from './routes/downloads.js';
import maintenanceRouter from './routes/maintenance.js';

import { LocalSyncServer } from './services/LocalSyncServer.js';
import { RemoteControlServer } from './services/RemoteControlServer.js';
import { refreshLibraryWatcherPaths, setLibraryWatcherIo } from './services/LibraryWatcher.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// CORS configuration from environment
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'];

const io = new Server(httpServer, {
   cors: {
     origin: corsOrigins,
     credentials: true,
     methods: ['GET', 'POST'],
   },
 });

scannerService.setIo(io);
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
  message: { data: { message: 'Too many requests from this IP, please try again after 15 minutes' } },
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
app.use('/api/downloads', downloadsRouter);
app.use('/api/maintenance', maintenanceRouter);

// Serve covers
app.use('/api/covers', express.static(path.join(__dirname, '../cache/covers')));

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Zovyra Server running on port ${PORT}`);
});
