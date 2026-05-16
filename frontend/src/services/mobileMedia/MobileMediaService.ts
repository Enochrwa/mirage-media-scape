import { Capacitor } from '@capacitor/core';
import type { MediaFile } from '@/types/media';

/**
 * Queries the device OS media database directly.
 * Android: MediaStore API via @odion-cloud/capacitor-mediastore
 * iOS: MPMediaLibrary via the same plugin (iOS support in progress — falls back gracefully)
 *
 * This is the mobile equivalent of the server's Rust scanner.
 * No server involved. No filesystem walking. Results in < 500ms.
 */
export class MobileMediaService {
  static async requestPermissions(): Promise<boolean> {
    try {
      const { CapacitorMediaStore } = await import('@odion-cloud/capacitor-mediastore');
      const result = await CapacitorMediaStore.requestPermissions({
        types: ['audio', 'video'],
      });
      return result.audio === 'granted' || result.video === 'granted';
    } catch (e) {
      console.error('[MobileMedia] Permission request failed', e);
      return false;
    }
  }

  static async getAllAudio(): Promise<MediaFile[]> {
    try {
      const { CapacitorMediaStore } = await import('@odion-cloud/capacitor-mediastore');
      const result = await CapacitorMediaStore.getMediasByType({
        mediaType: 'audio',
        sortBy: 'TITLE',
        includeExternal: true, // include SD card
      });

      return result.medias.map((item) => ({
        id: item.id ?? item.path,
        title: item.title ?? item.name ?? 'Unknown',
        artist: item.artist ?? undefined,
        album: item.album ?? undefined,
        cover: item.albumArtPath ?? undefined,
        file: Capacitor.convertFileSrc(item.path), // converts native path to web-accessible URL
        file_path: item.path,
        type: 'audio' as const,
        duration: item.duration ? item.duration / 1000 : undefined, // ms → seconds
        bitrate: item.bitrate ? String(item.bitrate) : undefined,
        sampleRate: item.sampleRate ? String(item.sampleRate) : undefined,
        year: item.year ? parseInt(item.year) : undefined,
        genre: item.genre ?? undefined,
        size: item.size ?? undefined,
      }));
    } catch (e) {
      console.error('[MobileMedia] Failed to query audio', e);
      return [];
    }
  }

  static async getAllVideo(): Promise<MediaFile[]> {
    try {
      const { CapacitorMediaStore } = await import('@odion-cloud/capacitor-mediastore');
      const result = await CapacitorMediaStore.getMediasByType({
        mediaType: 'video',
        sortBy: 'TITLE',
        includeExternal: true,
      });

      return result.medias.map((item) => ({
        id: item.id ?? item.path,
        title: item.title ?? item.name ?? 'Unknown',
        artist: item.artist ?? undefined,
        cover: item.thumbnailPath ?? undefined,
        file: Capacitor.convertFileSrc(item.path),
        file_path: item.path,
        type: 'video' as const,
        duration: item.duration ? item.duration / 1000 : undefined,
        width: item.width ?? undefined,
        height: item.height ?? undefined,
        size: item.size ?? undefined,
      }));
    } catch (e) {
      console.error('[MobileMedia] Failed to query video', e);
      return [];
    }
  }

  static async getAll(): Promise<MediaFile[]> {
    const [audio, video] = await Promise.all([this.getAllAudio(), this.getAllVideo()]);
    return [...audio, ...video];
  }
}
