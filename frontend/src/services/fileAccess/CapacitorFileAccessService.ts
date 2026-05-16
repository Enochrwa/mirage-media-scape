import { Filesystem, Directory } from '@capacitor/filesystem';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import type { IFileAccessService } from './IFileAccessService';

export class CapacitorFileAccessService implements IFileAccessService {
  async pickFolder(): Promise<string | null> {
    try {
      const result = await FilePicker.pickDirectory();
      return result.path || null;
    } catch (e) {
      console.error('[CapacitorFileAccess] Failed to pick directory:', e);
      // Fallback to Directory.Data if user cancels or plugin fails
      return Directory.Data;
    }
  }

  async readFile(path: string): Promise<Uint8Array> {
    // If path is a full Capacitor URL or external path, Filesystem might need it as is
    // If it's relative, we assume it's in Directory.Data (or children)
    const result = await Filesystem.readFile({
      path,
      // If path starts with a / or a protocol, don't provide directory
      directory: path.startsWith('/') || path.includes('://') ? undefined : Directory.Data,
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
