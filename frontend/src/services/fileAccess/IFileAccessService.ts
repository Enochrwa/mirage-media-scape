export interface IFileAccessService {
  pickFolder(): Promise<string | null>
  readFile(path: string): Promise<Uint8Array>
  watchDirectory(path: string, onChange: () => void): Promise<() => void>
}
