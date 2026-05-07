import { AudioMetadata } from '../sonic-native';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db from '../db';

// Use require for the native module as it's a .node file
const native = require('../../sonic-native.node');

export interface ScanProgress {
    total: number;
    processed: number;
    currentFile: string;
}

export class ScannerService {
    private isScanning = false;

    async scanDirectory(dirPath: string, onProgress?: (progress: ScanProgress) => void) {
        if (this.isScanning) return;
        this.isScanning = true;

        try {
            const files = this.getAllFiles(dirPath);
            const total = files.length;
            let processed = 0;

            for (const filePath of files) {
                processed++;
                if (onProgress) {
                    onProgress({ total, processed, currentFile: path.basename(filePath) });
                }

                await this.processFile(filePath);
            }
        } finally {
            this.isScanning = false;
        }
    }

    private getAllFiles(dirPath: string, files: string[] = []): string[] {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                this.getAllFiles(fullPath, files);
            } else if (this.isMediaFile(entry.name)) {
                files.push(fullPath);
            }
        }

        return files;
    }

    private isMediaFile(filename: string): boolean {
        const extensions = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.mp4', '.mkv', '.avi'];
        return extensions.includes(path.extname(filename).toLowerCase());
    }

    private async processFile(filePath: string) {
        const stats = fs.statSync(filePath);
        const mtime = stats.mtimeMs;
        const fileSize = stats.size;

        // Check if file is already in DB and hasn't changed
        const existing = db.prepare('SELECT mtime FROM tracks WHERE file_path = ?').get(filePath) as { mtime: number } | undefined;

        if (existing && existing.mtime === mtime) {
            return; // Skip unchanged file
        }

        try {
            const metadata: AudioMetadata = native.analyzeAudio(filePath);
            const id = crypto.createHash('md5').update(filePath).digest('hex');

            db.prepare(`
                INSERT OR REPLACE INTO tracks (
                    id, title, artist, album, genre, year, duration,
                    bitrate, sample_rate, channels, file_path, file_size,
                    mtime, added_at, loudness, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id,
                metadata.title || path.basename(filePath),
                metadata.artist || 'Unknown Artist',
                metadata.album || 'Unknown Album',
                metadata.genre || 'Unknown Genre',
                metadata.year || null,
                metadata.duration,
                metadata.bitrate,
                metadata.sampleRate,
                metadata.channels,
                filePath,
                fileSize,
                mtime,
                Date.now(),
                metadata.loudness || null,
                JSON.stringify(metadata)
            );
        } catch (error) {
            console.error(`Failed to process file ${filePath}:`, error);
        }
    }
}

export const scannerService = new ScannerService();
