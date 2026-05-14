import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  ListMusic,
  WifiOff,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { cn, formatDuration } from '@/lib/utils';

interface RemoteTrack {
  id: string;
  cover?: string;
  title?: string;
  artist?: string;
  duration?: number;
}

interface RemoteState {
  track?: RemoteTrack;
  isPlaying?: boolean;
  volume?: number;
  currentTime?: number;
  duration?: number;
  queue?: RemoteTrack[];
}

const sanitizeUrl = (url?: string): string => {
  if (!url) return '/placeholder.svg';

  // Only allow relative paths, standard http(s) protocols, or data images
  const safePrefixes = ['/', 'http://', 'https://', 'data:image/'];
  const isSafe = safePrefixes.some((prefix) => url.startsWith(prefix));

  if (isSafe) {
    // Double check for common XSS patterns like javascript: inside the URL string
    if (!url.toLowerCase().includes('javascript:')) {
      return url;
    }
  }

  return '/placeholder.svg';
};

const RemotePage = () => {
  const [state, setState] = useState<RemoteState | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQueue, setShowQueue] = useState(false);

  const connect = () => {
    setError(null);
    const socket = new WebSocket(`ws://${window.location.hostname}:8765?type=remote`);

    socket.onopen = () => console.log('Remote connected');
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'STATE' && msg.payload) {
        const payload = msg.payload;
        // Pre-sanitize all URLs before putting them in state
        if (payload.track) {
          payload.track.cover = sanitizeUrl(payload.track.cover);
        }
        if (payload.queue) {
          payload.queue = payload.queue.map((item: RemoteTrack) => ({
            ...item,
            cover: sanitizeUrl(item.cover),
          }));
        }
        setState(payload);
      }
    };
    socket.onclose = () => {
      setError('Connection lost');
      setWs(null);
    };
    socket.onerror = () => setError('Connection error');

    setWs(socket);
  };

  useEffect(() => {
    connect();
    return () => {
      if (ws) ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendCommand = (type: string, payload?: unknown) => {
    // Optimistic UI
    if (type === 'TOGGLE' && state) {
      setState({ ...state, isPlaying: !state.isPlaying });
    }
    ws?.send(JSON.stringify({ type, payload }));
  };

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-8 text-center text-white">
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
          <p className="text-zinc-500">Waiting for Zovyra Player...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-zinc-950 text-white">
      {error && (
        <div className="flex w-full items-center justify-between bg-red-600 px-4 py-2 text-sm font-bold">
          <div className="flex items-center gap-2">
            <WifiOff size={16} /> {error}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={connect}
            className="h-7 border border-white/20 text-xs"
          >
            Reconnect
          </Button>
        </div>
      )}

      {/* Hero Art Background */}
      <div className="absolute inset-0 z-0 opacity-20 blur-3xl">
        {state.track?.cover && (
          <img src={state.track.cover} className="h-full w-full object-cover" alt="" />
        )}
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-1 flex-col items-center justify-center space-y-8 p-6">
        <Card className="mx-auto aspect-square w-full max-w-[80vw] overflow-hidden rounded-2xl border-white/10 shadow-2xl">
          <img
            src={state.track?.cover || '/placeholder.svg'}
            className="h-full w-full object-cover"
            alt=""
          />
        </Card>

        <div className="w-full space-y-1 text-center">
          <h1 className="truncate text-3xl font-black">{state.track?.title}</h1>
          <p className="truncate text-lg font-medium text-zinc-400">{state.track?.artist}</p>
        </div>

        {/* Progress */}
        <div className="w-full space-y-2">
          <Slider
            value={[state.currentTime || 0]}
            max={state.duration || 100}
            onValueChange={([v]) => sendCommand('SEEK', v)}
            className="cursor-pointer"
          />
          <div className="flex justify-between font-mono text-[10px] text-zinc-500">
            <span>{formatDuration(state.currentTime || 0)}</span>
            <span>{formatDuration(state.duration || 0)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12"
            onClick={() => sendCommand('PREV')}
          >
            <SkipBack size={32} />
          </Button>
          <Button
            size="icon"
            className="h-20 w-20 rounded-full bg-purple-600 text-white shadow-xl shadow-purple-900/20"
            onClick={() => sendCommand('TOGGLE')}
          >
            {state.isPlaying ? (
              <Pause size={36} fill="currentColor" />
            ) : (
              <Play size={36} fill="currentColor" className="ml-1" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12"
            onClick={() => sendCommand('NEXT')}
          >
            <SkipForward size={32} />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Volume2 size={20} className="text-zinc-500" />
            <Slider
              value={[(state.volume ?? 1) * 100]}
              max={100}
              onValueChange={([v]) => sendCommand('VOLUME', v / 100)}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6 p-6 pb-12">
        <div className="flex items-center gap-4">
          <Volume2 size={20} className="text-zinc-500" />
          <Slider
            value={[(state.volume ?? 1) * 100]}
            max={100}
            onValueChange={([v]) => sendCommand('VOLUME', v / 100)}
          />
        </div>

        <Button
          variant="outline"
          onClick={() => setShowQueue(!showQueue)}
          className="h-12 w-full gap-2 border-white/10 bg-white/5 text-zinc-300"
        >
          <ListMusic size={20} />
          Up Next
        </Button>
      </div>

      {showQueue && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl duration-300 animate-in slide-in-from-bottom">
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <h2 className="text-xl font-bold">Up Next</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowQueue(false)}>
              <AlertCircle />
            </Button>
          </div>
          <div className="h-full space-y-2 overflow-y-auto p-4 pb-32">
            {state.queue?.slice(0, 10).map((t, i) => (
              <div
                key={i}
                onClick={() => {
                  sendCommand('JUMP', i);
                  setShowQueue(false);
                }}
                className="flex cursor-pointer items-center gap-4 rounded-xl p-3 hover:bg-white/5"
              >
                <img
                  src={t.cover || '/placeholder.svg'}
                  className="h-12 w-12 rounded-lg object-cover"
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{t.title}</p>
                  <p className="truncate text-xs text-zinc-500">{t.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RemotePage;
