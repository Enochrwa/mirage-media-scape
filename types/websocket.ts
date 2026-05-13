export type WebSocketEventType =
  | 'SCAN_PROGRESS'
  | 'NEW_TRACKS'
  | 'DOWNLOAD_PROGRESS'
  | 'RADIO_META'
  | 'PODCAST_UPDATED'
  | 'QUEUE_UPDATE'
  | 'POSITION_CHECKPOINT'
  | 'PLAYLIST_SAVE'
  | 'PLAYLIST_DELETE'
  | 'SETTINGS_CHANGE'
  | 'RATING_CHANGE'
  | 'DOWNLOAD_COMPLETE';

export interface WebSocketEvent<T = any> {
  type: WebSocketEventType;
  payload: T;
  deviceId?: string;
  timestamp: number;
}
