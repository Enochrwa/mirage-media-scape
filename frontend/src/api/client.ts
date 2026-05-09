import { API_BASE } from '@/lib/utils';

export class APIClient {
  private static async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  static getTracks() {
    return this.request('/api/tracks');
  }

  static getSmartPlaylists() {
    return this.request('/api/playlists/smart');
  }

  static startScan(directory?: string) {
    return this.request('/api/scanner/scan', {
      method: 'POST',
      body: JSON.stringify({ directory }),
    });
  }

  static getRecommendations(trackId: string) {
    return this.request(`/api/tracks/${trackId}/recommendations`);
  }
}
