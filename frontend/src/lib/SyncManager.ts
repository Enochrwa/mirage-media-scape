import { useLibraryStore } from '@/store/useLibraryStore';

export class SyncManager {
  static init() {
    const socket = useLibraryStore.getState().socket;
    if (!socket) return;

    socket.on(
      'RADIO_FAVORITE_CHANGE',
      (data: { stationuuid: string; action: 'add' | 'remove' }) => {
        console.log('Radio favorite changed on another device', data);
        window.dispatchEvent(new CustomEvent('zovyra-refresh-radio'));
      },
    );

    socket.on('POSITION_CHECKPOINT', (data: unknown) => {
      window.dispatchEvent(new CustomEvent('zovyra-sync-position', { detail: data }));
    });

    socket.on('LIBRARY_SCAN_IN_PROGRESS', (data: unknown) => {
      window.dispatchEvent(new CustomEvent('zovyra-scan-status', { detail: data }));
    });
  }

  static emit(type: string, payload: unknown) {
    const socket = useLibraryStore.getState().socket;
    if (socket) {
      socket.emit(type, payload);
    }
  }
}
