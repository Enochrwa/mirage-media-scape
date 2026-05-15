export interface ITrayService {
  updateStatus(isPlaying: boolean): Promise<void>
  showMiniPlayer(): Promise<void>
}
