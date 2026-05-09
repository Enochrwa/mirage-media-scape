import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../usePlayerStore';
import { MediaFile } from '@/types/media';

// Mock playback engine
vi.mock('@/lib/PlaybackEngine', () => {
  return {
    playbackEngine: {
      setVolume: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      setState: vi.fn(),
      subscribe: vi.fn(),
      ctx: {
        decodeAudioData: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
});

describe('usePlayerStore', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      currentFile: null,
      isPlaying: false,
      volume: 0.8,
      currentTime: 0,
      duration: 0,
      shuffle: false,
      repeat: false,
    });
  });

  const mockFile: MediaFile = {
    id: '1',
    title: 'Test Track',
    artist: 'Test Artist',
    album: 'Test Album',
    file: 'test.mp3',
    type: 'audio',
    duration: 180,
    file_path: '/path/to/test.mp3',
    cover: null,
    loudness: null,
    bpm: null,
    camelot_key: null,
    key: null,
    genre: null,
    year: null,
    bitrate: null,
    sampleRate: null,
  };

  it('should set current file and play', async () => {
    await usePlayerStore.getState().playFile(mockFile);
    expect(usePlayerStore.getState().currentFile).toEqual(mockFile);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it('should toggle playback', () => {
    usePlayerStore.setState({ currentFile: mockFile, isPlaying: true });
    usePlayerStore.getState().togglePlayback();
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    usePlayerStore.getState().togglePlayback();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it('should handle volume changes', () => {
    usePlayerStore.getState().setVolume(0.5);
    expect(usePlayerStore.getState().volume).toBe(0.5);
  });

  it('should navigate to next track', async () => {
    const files = [mockFile, { ...mockFile, id: '2' }];
    usePlayerStore.setState({ currentFile: mockFile });

    usePlayerStore.getState().nextTrack(files);
    expect(usePlayerStore.getState().currentFile?.id).toBe('2');
  });

  it('should repeat when at end of list if repeat is on', () => {
    const files = [mockFile, { ...mockFile, id: '2' }];
    usePlayerStore.setState({ currentFile: files[1], repeat: true });

    usePlayerStore.getState().nextTrack(files);
    expect(usePlayerStore.getState().currentFile?.id).toBe('1');
  });
});
