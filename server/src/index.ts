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
import { execSync } from 'child_process';
import native from './utils/native-loader.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS configuration from environment
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8080',
      'http://localhost:8081',
      'tauri://localhost',
      'http://tauri.localhost',
      'capacitor://localhost',
      'http://localhost',
    ];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      // Allow requests with no origin (same-origin, curl, Tauri, mobile webview)
      if (!origin || corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

scannerService.setIo(io);
analysisService.setIo(io);
setLibraryWatcherIo(io);
await refreshLibraryWatcherPaths();

// Check for ffmpeg
try {
  execSync('ffmpeg -version', { stdio: 'pipe' });
} catch {
  console.warn('[zovyra] ffmpeg not found — transcoding disabled');
}

// Check hardware acceleration
try {
  const hwSupport = native.initialize_hardware_decode();
  console.log('[zovyra] Hardware decoding initialized:', hwSupport);
} catch (e) {
  console.warn('[zovyra] Hardware decoding initialization failed:', e);
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }),
);
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
  // Startup scan is intentionally NOT performed here.
  // Scanning is triggered explicitly by:
  //   - Desktop app: POST /api/scanner/auto-scan-defaults (only when library is stale or empty)
  //   - User action:  POST /api/scanner/scan
  //   - Onboarding:   POST /api/scanner/onboarding/home | /onboarding/choose-folder
  // This prevents unwanted background scans when the server is accessed from any host.
});
