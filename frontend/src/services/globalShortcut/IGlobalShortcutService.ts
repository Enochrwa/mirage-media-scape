export interface IGlobalShortcutService {
  register(shortcut: string, handler: () => void): Promise<void>;
  unregister(shortcut: string): Promise<void>;
}
