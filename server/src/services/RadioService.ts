export class RadioService {
    private static API_URL = 'https://de1.api.radio-browser.info/json';

    static async search(query: string): Promise<any[]> {
        try {
            const res = await fetch(`${this.API_URL}/stations/byname/${encodeURIComponent(query)}?limit=20`);
            if (res.ok) return await res.json() as any[];
        } catch (e) {
            console.error('Radio search failed', e);
        }
        return [];
    }

    static async getTopStations(): Promise<any[]> {
        try {
            const res = await fetch(`${this.API_URL}/stations/topclick/20`);
            if (res.ok) return await res.json() as any[];
        } catch (e) {
            console.error('Failed to fetch top stations', e);
        }
        return [];
    }
}
