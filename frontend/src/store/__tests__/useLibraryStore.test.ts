import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLibraryStore } from '../useLibraryStore';
import { MediaFile } from '@/types/media';

// Mock IDB
vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockResolvedValue([]),
    transaction: vi.fn().mockReturnValue({
      store: {
        clear: vi.fn(),
        put: vi.fn(),
      },
      done: Promise.resolve(),
    }),
    objectStoreNames: {
      contains: vi.fn().mockReturnValue(true),
    },
  }),
}));

// Mock Socket.io
vi.mock('socket.io-client', () => ({
  io: vi.fn().mockReturnValue({
    on: vi.fn(),
    emit: vi.fn(),
  }),
}));

describe('useLibraryStore', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      files: [],
      playlists: [],
      smartPlaylists: [],
      scanProgress: null,
    });
  });

  it('should initialize with empty state', () => {
    const state = useLibraryStore.getState();
    expect(state.files).toEqual([]);
    expect(state.playlists).toEqual([]);
  });

  it('should create a playlist', () => {
    useLibraryStore.getState().createPlaylist('My Playlist');
    const state = useLibraryStore.getState();
    expect(state.playlists.length).toBe(1);
    expect(state.playlists[0].name).toBe('My Playlist');
  });

  it('should add to playlist', () => {
    const mockFile: MediaFile = { id: '1', title: 'Song 1' } as MediaFile;
    useLibraryStore.setState({ files: [mockFile] });
    useLibraryStore.getState().createPlaylist('My Playlist');
    const playlistId = useLibraryStore.getState().playlists[0].id;

    useLibraryStore.getState().addToPlaylist(playlistId, '1');

    const playlist = useLibraryStore.getState().playlists[0];
    expect(playlist.files.length).toBe(1);
    expect(playlist.files[0].id).toBe('1');
  });
});
