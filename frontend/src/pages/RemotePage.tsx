import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';

const RemotePage = () => {
    const [state, setState] = useState<any>(null);
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

    const sendCommand = (type: string, payload?: any) => {
        ws?.send(JSON.stringify({ type, payload }));
    };

    if (!state) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black text-white p-8 text-center">
                <div className="space-y-4">
                    <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-zinc-500">Waiting for Sonic Player...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-6 flex flex-col items-center justify-between">
            <div className="w-full max-w-md space-y-8 text-center pt-8">
                <Card className="aspect-square w-64 mx-auto overflow-hidden rounded-2xl shadow-2xl border-white/10">
                    <img src={state.track?.cover || '/placeholder.svg'} className="w-full h-full object-cover" alt="" />
                </Card>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold truncate">{state.track?.title}</h1>
                    <p className="text-zinc-400 truncate">{state.track?.artist}</p>
                </div>

                <div className="flex items-center justify-center gap-8">
                    <Button variant="ghost" size="icon" className="w-12 h-12" onClick={() => sendCommand('PREV')}>
                        <SkipBack size={32} />
                    </Button>
                    <Button
                        size="icon"
                        className="w-20 h-20 bg-white text-black rounded-full"
                        onClick={() => sendCommand('TOGGLE')}
                    >
                        {state.isPlaying ? <Pause size={40} /> : <Play size={40} className="ml-1" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="w-12 h-12" onClick={() => sendCommand('NEXT')}>
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
