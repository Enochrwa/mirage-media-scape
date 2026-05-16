import { Filesystem, Directory } from '@capacitor/filesystem';
import type { IOfflineCacheService } from './IOfflineCacheService';

export class CapacitorOfflineCacheService implements IOfflineCacheService {
  private readonly CACHE_DIR = 'media-cache';

  constructor() {
    this.ensureCacheDir();
  }

  private async ensureCacheDir() {
    try {
      await Filesystem.mkdir({
        path: this.CACHE_DIR,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e) {
      // Ignore if directory already exists
    }
  }

  async cacheTrack(id: string, data: Uint8Array): Promise<void> {
    await this.ensureCacheDir();

    // Convert Uint8Array to base64
    let binary = '';
    const len = data.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(data[i]);
    }
    const base64 = btoa(binary);

    await Filesystem.writeFile({
      path: `${this.CACHE_DIR}/${id}.dat`,
      data: base64,
      directory: Directory.Data,
    });
  }

  async getCachedTrack(id: string): Promise<Uint8Array | null> {
    try {
      const result = await Filesystem.readFile({
        path: `${this.CACHE_DIR}/${id}.dat`,
        directory: Directory.Data,
      });

      const data = result.data;
      if (typeof data === 'string') {
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }
      return new Uint8Array(await (data as unknown as Blob).arrayBuffer());
    } catch (e) {
      return null;
    }
  }

  async isCached(id: string): Promise<boolean> {
    try {
      const stat = await Filesystem.stat({
        path: `${this.CACHE_DIR}/${id}.dat`,
        directory: Directory.Data,
      });
      return !!stat;
    } catch (e) {
      return false;
    }
  }
}
