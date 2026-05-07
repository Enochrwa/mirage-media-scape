import db from '../src/db';

describe('Database', () => {
    it('should have initialized the tracks table', () => {
        const tableInfo = db.prepare("PRAGMA table_info(tracks)").all();
        expect(tableInfo.length).toBeGreaterThan(0);
        const columnNames = tableInfo.map((c: any) => c.name);
        expect(columnNames).toContain('file_path');
        expect(columnNames).toContain('mtime');
        expect(columnNames).toContain('loudness');
    });

    it('should be in WAL mode', () => {
        const journalMode = db.pragma('journal_mode', { simple: true });
        expect(journalMode).toBe('wal');
    });
});
