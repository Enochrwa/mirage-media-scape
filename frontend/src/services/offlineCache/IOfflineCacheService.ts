export interface IOfflineCacheService {
  cacheTrack(id: string, data: Uint8Array): Promise<void>;
  getCachedTrack(id: string): Promise<Uint8Array | null>;
  isCached(id: string): Promise<boolean>;
}
