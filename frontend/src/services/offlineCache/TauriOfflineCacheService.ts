import type { IOfflineCacheService } from './IOfflineCacheService';
import { readFile, writeFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';

export class TauriOfflineCacheService implements IOfflineCacheService {
  private cacheDir = 'offline-tracks';

  private async ensureDir() {
    if (!(await exists(this.cacheDir, { baseDir: BaseDirectory.AppCache }))) {
      await mkdir(this.cacheDir, { baseDir: BaseDirectory.AppCache, recursive: true });
    }
  }

  async cacheTrack(id: string, data: Uint8Array): Promise<void> {
    await this.ensureDir();
    await writeFile(`${this.cacheDir}/${id}`, data, { baseDir: BaseDirectory.AppCache });
  }

  async getCachedTrack(id: string): Promise<Uint8Array | null> {
    try {
      return await readFile(`${this.cacheDir}/${id}`, { baseDir: BaseDirectory.AppCache });
    } catch {
      return null;
    }
  }

  async isCached(id: string): Promise<boolean> {
    return await exists(`${this.cacheDir}/${id}`, { baseDir: BaseDirectory.AppCache });
  }
}
