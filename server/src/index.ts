import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db';
import scannerRouter from './routes/scanner';
import tracksRouter from './routes/tracks';
import playlistsRouter from './routes/playlists';
import statsRouter from './routes/stats';
import subtitlesRouter from './routes/subtitles';
import radioRouter from './routes/radio';
import { LocalSyncServer } from './services/LocalSyncServer';
import { RemoteControlServer } from './services/RemoteControlServer';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

scannerService.setIo(io);
scannerService.init();

const syncServer = new LocalSyncServer();
const remoteServer = new RemoteControlServer();

app.use(cors());
app.use(express.json());

app.use('/api/scanner', scannerRouter);
app.use('/api/tracks', tracksRouter);
app.use('/api/playlists/smart', playlistsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/subtitles', subtitlesRouter);
app.use('/api/radio', radioRouter);

const PORT = process.env.PORT || 3001;

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: db.name });
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Sonic Server running on port ${PORT}`);
});
