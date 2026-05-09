export interface RadioStation {
    changeid: string;
    stationuuid: string;
    name: string;
    url: string;
    url_resolved: string;
    homepage: string;
    favicon: string;
    tags: string;
    country: string;
    countrycode: string;
    state: string;
    language: string;
    languagecodes: string;
    votes: number;
    lastchangetime: string;
    codec: string;
    bitrate: number;
    hls: number;
    lastcheckok: number;
    lastchecktime: string;
    lastcheckoktime: string;
    lastlocalchecktime: string;
    clicktimestamp: string;
    clickcount: number;
    clicktrend: number;
    ssl_error: number;
    geo_lat: number | null;
    geo_long: number | null;
    has_extended_info: boolean;
}

export class RadioService {
    private static API_URL = 'https://de1.api.radio-browser.info/json';

    static async search(query: string): Promise<RadioStation[]> {
        try {
            const res = await fetch(`${this.API_URL}/stations/byname/${encodeURIComponent(query)}?limit=20`);
            if (res.ok) return (await res.json()) as RadioStation[];
        } catch (e) {
            console.error('Radio search failed', e);
        }
        return [];
    }

    static async getTopStations(): Promise<RadioStation[]> {
        try {
            const res = await fetch(`${this.API_URL}/stations/topclick/20`);
            if (res.ok) return (await res.json()) as RadioStation[];
        } catch (e) {
            console.error('Failed to fetch top stations', e);
        }
        return [];
    }
}
