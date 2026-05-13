import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, ListMusic, WifiOff, AlertCircle } from 'lucide-react';
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

const isSafeUrl = (url?: string) => {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('/');
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
      if (msg.type === 'STATE') {
        setState(msg.payload);
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
          <Button variant="ghost" size="sm" onClick={connect} className="h-7 text-xs border border-white/20">
            Reconnect
          </Button>
        </div>
      )}

      {/* Hero Art Background */}
      <div className="absolute inset-0 z-0 opacity-20 blur-3xl">
        {isSafeUrl(state.track?.cover) && (
          <img src={state.track?.cover} className="h-full w-full object-cover" alt="" />
        )}
      </div>

      <div className="relative z-10 w-full max-w-md flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        <Card className="mx-auto aspect-square w-full max-w-[80vw] overflow-hidden rounded-2xl border-white/10 shadow-2xl">
          {isSafeUrl(state.track?.cover) ? (
            <img src={state.track?.cover} className="h-full w-full object-cover" alt="" />
          ) : (
            <img src="/placeholder.svg" className="h-full w-full object-cover" alt="" />
          )}
        </Card>

        <div className="w-full space-y-1 text-center">
          <h1 className="truncate text-3xl font-black">{state.track?.title}</h1>
          <p className="truncate text-lg text-zinc-400 font-medium">{state.track?.artist}</p>
        </div>

        {/* Progress */}
        <div className="w-full space-y-2">
          <Slider
            value={[state.currentTime || 0]}
            max={state.duration || 100}
            onValueChange={([v]) => sendCommand('SEEK', v)}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
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
            {state.isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" className="ml-1" />}
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

      <div className="relative z-10 w-full max-w-md p-6 pb-12 space-y-6">
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
          className="w-full gap-2 border-white/10 bg-white/5 text-zinc-300 h-12"
        >
          <ListMusic size={20} />
          Up Next
        </Button>
      </div>

      {showQueue && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl animate-in slide-in-from-bottom duration-300">
           <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold">Up Next</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowQueue(false)}><AlertCircle /></Button>
           </div>
           <div className="overflow-y-auto h-full p-4 pb-32 space-y-2">
              {state.queue?.slice(0, 10).map((t, i) => (
                 <div
                   key={i}
                   onClick={() => { sendCommand('JUMP', i); setShowQueue(false); }}
                   className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer"
                 >
                    {isSafeUrl(t.cover) ? (
                      <img src={t.cover} className="w-12 h-12 rounded-lg object-cover" alt="" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-800" />
                    )}
                    <div className="min-w-0 flex-1">
                       <p className="font-bold truncate text-sm">{t.title}</p>
                       <p className="text-xs text-zinc-500 truncate">{t.artist}</p>
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
