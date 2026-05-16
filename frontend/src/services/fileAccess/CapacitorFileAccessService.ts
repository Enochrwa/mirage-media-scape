import { Filesystem, Directory } from '@capacitor/filesystem';
import type { IFileAccessService } from './IFileAccessService';

export class CapacitorFileAccessService implements IFileAccessService {
  async pickFolder(): Promise<string | null> {
    // In a real production app, we would use a community plugin like:
    // import { FilePicker } from '@capawesome/capacitor-file-picker';
    // const result = await FilePicker.pickDirectory();
    // return result.path;

    // For now, we return the App Data directory as the base for mobile media storage
    return Directory.Data;
  }

  async readFile(path: string): Promise<Uint8Array> {
    const result = await Filesystem.readFile({
      path,
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
  }

  async watchDirectory(_path: string, _onChange: () => void): Promise<() => void> {
    console.warn('[CapacitorFileAccess] Directory watching not supported on mobile');
    return () => {};
  }
}
