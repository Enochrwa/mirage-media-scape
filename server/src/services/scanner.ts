import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import * as chokidar from 'chokidar';
import db from '../db';
import { Server } from 'socket.io';
import os from 'os';

const COVERS_DIR = path.join(os.homedir(), '.sonic', 'covers');

export class ScannerService {
    private io?: Server;
    private watchers: Map<string, chokidar.FSWatcher> = new Map();
    private isScanning = false;

    setIo(io: Server) {
        this.io = io;
    }

    async init() {
        const folders = db.prepare('SELECT path FROM watched_folders').all() as { path: string }[];
        for (const folder of folders) {
            this.startWatcher(folder.path);
        }
    }

    async addFolder(folderPath: string) {
        try {
            db.prepare('INSERT OR IGNORE INTO watched_folders (path, added_at) VALUES (?, ?)').run(folderPath, Date.now());
            this.startWatcher(folderPath);
            this.scanFolders([folderPath]);
        } catch (error) {
            console.error('Failed to add folder:', error);
        }
    }

    private startWatcher(folderPath: string) {
        if (this.watchers.has(folderPath)) return;

        const watcher = chokidar.watch(folderPath, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true
        });

        watcher
            .on('add', filePath => this.processChangedFile(filePath))
            .on('change', filePath => this.processChangedFile(filePath))
            .on('unlink', filePath => this.markAsMissing(filePath));

        this.watchers.set(folderPath, watcher);
    }

    private async processChangedFile(filePath: string) {
        console.log(`File added/changed: ${filePath}`);
        // For simplicity, we trigger a small scan for this file
        // In a real implementation, we'd reuse the worker logic
        this.scanFolders([path.dirname(filePath)]);
    }

    private markAsMissing(filePath: string) {
        console.log(`File removed: ${filePath}`);
        db.prepare('UPDATE tracks SET missing = 1 WHERE file_path = ?').run(filePath);
        this.io?.emit('TRACK_MISSING', { filePath });
    }

    async scanAll() {
        if (this.isScanning) return;
        const folders = db.prepare('SELECT path FROM watched_folders').all() as { path: string }[];
        if (folders.length === 0) return;
        this.scanFolders(folders.map(f => f.path));
    }

    private scanFolders(folderPaths: string[]) {
        this.isScanning = true;

        // We use the transpiled .js file in production, but .ts in dev with ts-node
        const workerPath = path.resolve(__dirname, './scan-worker.ts');

        const worker = new Worker(`
            require('ts-node').register();
            require('${workerPath}');
        `, {
            eval: true,
            workerData: {
                dbPath: path.resolve(__dirname, '../../sonic.db'),
                folders: folderPaths,
                coversDir: COVERS_DIR
            }
        });

        worker.on('message', (msg) => {
            if (this.io) {
                this.io.emit(msg.type, msg);
            }
            if (msg.type === 'SCAN_COMPLETE') {
                this.isScanning = false;
            }
        });

        worker.on('error', (err) => {
            console.error('Worker error:', err);
            this.isScanning = false;
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Worker stopped with exit code ${code}`);
            }
            this.isScanning = false;
        });
    }
}

export const scannerService = new ScannerService();
