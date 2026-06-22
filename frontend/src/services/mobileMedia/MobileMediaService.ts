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
      return (
        result.readMediaAudio === 'granted' ||
        result.readMediaVideo === 'granted' ||
        result.readExternalStorage === 'granted'
      );
    } catch (e) {
      console.error('[MobileMedia] Permission request failed', e);
      return false;
    }
  }

  static async getAllAudio(): Promise<MediaFile[]> {
    try {
      const { CapacitorMediaStore, MediaType: PluginMediaType } =
        await import('@odion-cloud/capacitor-mediastore');
      const result = await CapacitorMediaStore.getMediasByType({
        mediaType: PluginMediaType.AUDIO,
        sortBy: 'TITLE',
        includeExternal: true, // include SD card
      });

      return result.media.map((item) => ({
        id: item.id ?? item.uri,
        title: item.title ?? item.displayName ?? 'Unknown',
        artist: item.artist ?? undefined,
        album: item.album ?? undefined,
        cover: item.albumArtUri ?? undefined,
        file: Capacitor.convertFileSrc(item.uri), // converts native path to web-accessible URL
        file_path: item.uri,
        type: 'audio',
        duration: item.duration ? item.duration / 1000 : undefined, // ms → seconds
        bitrate: item.bitrate ? String(item.bitrate) : undefined,
        sampleRate: item.sampleRate ? String(item.sampleRate) : undefined,
        year: item.year ? item.year : undefined,
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
      const { CapacitorMediaStore, MediaType: PluginMediaType } =
        await import('@odion-cloud/capacitor-mediastore');
      const result = await CapacitorMediaStore.getMediasByType({
        mediaType: PluginMediaType.VIDEO,
        sortBy: 'TITLE',
        includeExternal: true,
      });

      return result.media.map((item) => ({
        id: item.id ?? item.uri,
        title: item.title ?? item.displayName ?? 'Unknown',
        artist: item.artist ?? undefined,
        cover: item.albumArtUri ?? undefined, // Using albumArtUri as proxy for thumbnail if available
        file: Capacitor.convertFileSrc(item.uri),
        file_path: item.uri,
        type: 'video',
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
    let all = [...audio, ...video];

    // Performance optimization for low-RAM devices (Task 11)
    const memory = navigator.deviceMemory || 4;
    if (memory < 1.5 && all.length > 5000) {
      console.warn('[MobileMedia] Low memory device detected. Limiting scan to 5000 tracks.');
      all = all.slice(0, 5000);
    }

    return all;
  }

  static getPlayableUri(track: MediaFile): string {
    const raw = track.file_path || track.file || '';
    if (!raw) return '';
    // content:// URIs (Android MediaStore) must be converted to a Capacitor
    // web-accessible URL via convertFileSrc. Plain file:// URIs also need it.
    // http(s):// stream URLs can be returned as-is.
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    try {
      return Capacitor.convertFileSrc(raw);
    } catch (_e) {
      return raw;
    }
  }
}
