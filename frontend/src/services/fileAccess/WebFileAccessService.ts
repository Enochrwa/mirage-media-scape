import type { IFileAccessService } from './IFileAccessService';

export class WebFileAccessService implements IFileAccessService {
  async pickFolder(): Promise<string | null> {
    if (!('showDirectoryPicker' in window)) return null;
    try {
      const handle = await (
        window as unknown as { showDirectoryPicker(): Promise<{ name: string }> }
      ).showDirectoryPicker();
      return handle.name;
    } catch {
      return null;
    }
  }

  async readFile(_path: string): Promise<Uint8Array> {
    throw new Error('Direct file read unavailable in browser — use file picker');
  }

  async watchDirectory(_path: string, _onChange: () => void): Promise<() => void> {
    return () => {};
  }
}
