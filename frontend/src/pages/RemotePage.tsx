import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';

interface RemoteState {
  track?: {
    cover?: string;
    title?: string;
    artist?: string;
  };
  isPlaying?: boolean;
  volume?: number;
}

const RemotePage = () => {
  const [state, setState] = useState<RemoteState | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // In a real app, the host would be determined from the URL or discovery
    const socket = new WebSocket(`ws://${window.location.hostname}:8765?type=remote`);

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'STATE') {
        setState(msg.payload);
      }
    };

    setWs(socket);
    return () => socket.close();
  }, []);

  const sendCommand = (type: string, payload?: unknown) => {
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
    <div className="flex min-h-screen flex-col items-center justify-between bg-zinc-950 p-6 text-white">
      <div className="w-full max-w-md space-y-8 pt-8 text-center">
        <Card className="mx-auto aspect-square w-64 overflow-hidden rounded-2xl border-white/10 shadow-2xl">
          <img
            src={state.track?.cover || '/placeholder.svg'}
            className="h-full w-full object-cover"
            alt=""
          />
        </Card>

        <div className="space-y-2">
          <h1 className="truncate text-2xl font-bold">{state.track?.title}</h1>
          <p className="truncate text-zinc-400">{state.track?.artist}</p>
        </div>

        <div className="flex items-center justify-center gap-8">
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
            className="h-20 w-20 rounded-full bg-white text-black"
            onClick={() => sendCommand('TOGGLE')}
          >
            {state.isPlaying ? <Pause size={40} /> : <Play size={40} className="ml-1" />}
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
              value={[state.volume * 100]}
              max={100}
              onValueChange={([v]) => sendCommand('VOLUME', v / 100)}
            />
          </div>
        </div>
      </div>

      <div className="w-full max-w-md pb-8">
        <Button variant="outline" className="w-full gap-2 border-white/10 text-zinc-400">
          <ListMusic size={20} />
          View Queue
        </Button>
      </div>
    </div>
  );
};

export default RemotePage;
