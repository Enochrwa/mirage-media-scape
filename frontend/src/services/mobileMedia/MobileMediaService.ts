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
    return [...audio, ...video];
  }
}
