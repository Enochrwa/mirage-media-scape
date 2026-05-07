import db from '../db';

export interface AudioFeatures {
    bpm: number;
    loudness: number;
}

export class RecommendationService {
    static findSimilar(targetId: string, limit: number = 10): any[] {
        const target = db.prepare('SELECT bpm, loudness FROM tracks WHERE id = ?').get(targetId) as AudioFeatures | undefined;

        if (!target || !target.bpm || target.loudness === null) {
            return [];
        }

        // Optimization: Fetch only tracks with similar BPM (+/- 30) to reduce in-memory processing
        const allTracks = db.prepare(`
            SELECT id, title, artist, bpm, loudness
            FROM tracks
            WHERE id != ? AND bpm BETWEEN ? AND ?
        `).all(targetId, target.bpm - 30, target.bpm + 30) as (AudioFeatures & { id: string })[];

        const scored = allTracks.map(track => {
            if (!track.bpm || track.loudness === null) return { ...track, score: 0 };

            const score = this.calculateSimilarity(target, track);
            return { ...track, score };
        });

        return scored
            .filter(t => t.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    private static calculateSimilarity(a: AudioFeatures, b: AudioFeatures): number {
        // Simple Euclidean distance normalized for BPM and Loudness
        // BPM range ~60-200, Loudness range ~ -60 to 0
        const bpmDiff = Math.abs(a.bpm - b.bpm) / 140;
        const loudnessDiff = Math.abs(a.loudness - b.loudness) / 60;

        // Weight BPM more for "mood" similarity
        const distance = Math.sqrt(Math.pow(bpmDiff * 0.7, 2) + Math.pow(loudnessDiff * 0.3, 2));

        // Return similarity (1 - distance)
        return Math.max(0, 1 - distance);
    }
}
