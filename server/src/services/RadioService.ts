export interface RadioBrowserStation {
  stationuuid?: string;
  name: string;
  url: string;
  url_resolved?: string;
  favicon?: string;
  homepage?: string;
  country?: string;
  language?: string;
  tags?: string;
  codec?: string;
  bitrate?: number;
  clickcount?: number;
  clicktrend?: number;
}

export class RadioService {
  private static API_URL = 'https://de1.api.radio-browser.info/json';

  static async search(query: string): Promise<RadioBrowserStation[]> {
    try {
      const res = await fetch(`${this.API_URL}/stations/byname/${encodeURIComponent(query)}?limit=20`);
      if (res.ok) {
        const data: unknown = await res.json();
        return Array.isArray(data) ? (data as RadioBrowserStation[]) : [];
      }
    } catch (e) {
      console.error('Radio search failed', e);
    }
    return [];
  }

  static async getTopStations(): Promise<RadioBrowserStation[]> {
    try {
      const res = await fetch(`${this.API_URL}/stations/topclick/20`);
      if (res.ok) {
        const data: unknown = await res.json();
        return Array.isArray(data) ? (data as RadioBrowserStation[]) : [];
      }
    } catch (e) {
      console.error('Failed to fetch top stations', e);
    }
    return [];
  }
}
