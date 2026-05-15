import type { IOfflineCacheService } from './IOfflineCacheService'
import { openDB } from 'idb'

export class WebOfflineCacheService implements IOfflineCacheService {
  private dbPromise = openDB('zovyra-offline', 1, {
    upgrade(db) {
      db.createObjectStore('tracks')
    },
  })

  async cacheTrack(id: string, data: Uint8Array): Promise<void> {
    const db = await this.dbPromise
    await db.put('tracks', data, id)
  }

  async getCachedTrack(id: string): Promise<Uint8Array | null> {
    const db = await this.dbPromise
    return (await db.get('tracks', id)) || null
  }

  async isCached(id: string): Promise<boolean> {
    const db = await this.dbPromise
    const count = await db.count('tracks', id)
    return count > 0
  }
}
