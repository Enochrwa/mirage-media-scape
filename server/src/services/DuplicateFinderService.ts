import db from '../db';
import { Track } from '../types/database';

interface NativeModule {
    generateWaveformFingerprint: (path: string) => string;
}

let native: NativeModule;
try {
    native = require('../../sonic-native.node');
} catch {
    native = {
        generateWaveformFingerprint: () => '0'.repeat(64)
    };
}

interface Candidate {
    artist: string;
    dur: number;
}

export class DuplicateFinderService {
    static findCandidates(): Candidate[] {
        // Find tracks with same duration (rounded) and artist
        return db.prepare(`
            SELECT artist, ROUND(duration) as dur, COUNT(*) as count
            FROM tracks
            WHERE missing = 0 AND artist IS NOT NULL
            GROUP BY artist, dur
            HAVING count > 1
        `).all() as Candidate[];
    }

    static getDuplicateGroups(candidates: Candidate[]): Track[][] {
        const groups: Track[][] = [];
        for (const candidate of candidates) {
            const tracks = db.prepare(`
                SELECT * FROM tracks
                WHERE artist = ? AND ROUND(duration) = ? AND missing = 0
            `).all(candidate.artist, candidate.dur) as Track[];

            if (tracks.length < 2) continue;

            // Accurate pass: generate waveform fingerprints and compare Hamming distance
            try {
                const confirmedGroup: Track[] = [tracks[0]];
                const fp1 = native.generateWaveformFingerprint(tracks[0].file_path);

                for (let i = 1; i < tracks.length; i++) {
                    const fp2 = native.generateWaveformFingerprint(tracks[i].file_path);
                    if (this.compareFingerprints(fp1, fp2) <= 3) {
                        confirmedGroup.push(tracks[i]);
                    }
                }

                if (confirmedGroup.length > 1) {
                    groups.push(confirmedGroup);
                }
            } catch (e) {
                console.error('Accurate duplicate check failed:', e);
                // Fallback to basic match if native module fails
                groups.push(tracks);
            }
        }
        return groups;
    }

    private static compareFingerprints(fp1: string, fp2: string): number {
        let distance = 0;
        // Fingerprints are 32-char hex strings (64 chars actually, 32 bytes)
        for (let i = 0; i < fp1.length; i += 2) {
            const b1 = parseInt(fp1.substring(i, i + 2), 16);
            const b2 = parseInt(fp2.substring(i, i + 2), 16);

            // Hamming distance on bytes
            let xor = b1 ^ b2;
            while (xor > 0) {
                if (xor & 1) distance++;
                xor >>= 1;
            }
        }
        return distance;
    }
}
