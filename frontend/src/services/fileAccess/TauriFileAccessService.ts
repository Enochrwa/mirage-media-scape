import type { IFileAccessService } from './IFileAccessService'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile, watch } from '@tauri-apps/plugin-fs'

export class TauriFileAccessService implements IFileAccessService {
  async pickFolder(): Promise<string | null> {
    const selected = await open({ directory: true, multiple: false })
    return typeof selected === 'string' ? selected : null
  }

  async readFile(path: string): Promise<Uint8Array> {
    return await readFile(path)
  }

  async watchDirectory(path: string, onChange: () => void): Promise<() => void> {
    const unwatch = await watch(path, onChange, { recursive: true })
    return unwatch
  }
}
