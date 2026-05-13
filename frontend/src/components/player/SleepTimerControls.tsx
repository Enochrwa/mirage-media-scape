import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Moon, X } from 'lucide-react';

export const SleepTimerControls: React.FC = () => {
  const { playbackEngine } = usePlayerStore();
  const [state, setState] = useState(playbackEngine?.sleepTimer?.getState());
  const [customMinutes, setCustomMinutes] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setState(playbackEngine?.sleepTimer?.getState());
    }, 1000);
    return () => clearInterval(interval);
  }, [playbackEngine]);

  const setTimer = (mins: number) => {
    playbackEngine?.sleepTimer?.set(mins);
    setState(playbackEngine?.sleepTimer?.getState());
  };

  const cancelTimer = () => {
    playbackEngine?.sleepTimer?.clear();
    setState(playbackEngine?.sleepTimer?.getState());
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Moon className="h-5 w-5" />
          {state?.active && (
            <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {Math.ceil(state.remainingSeconds / 60)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-medium leading-none">Sleep Timer</h4>

          <div className="grid grid-cols-3 gap-2">
            {[15, 30, 45, 60, 90].map((mins) => (
              <Button key={mins} variant="outline" size="sm" onClick={() => setTimer(mins)}>
                {mins} min
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                playbackEngine?.sleepTimer?.setEndOfTrack(
                  window as unknown as {
                    addEventListener: (
                      type: string,
                      listener: () => void,
                      options?: unknown,
                    ) => void;
                  },
                )
              }
            >
              End of Track
            </Button>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Minutes"
              type="number"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
            />
            <Button size="sm" onClick={() => setTimer(parseInt(customMinutes))}>
              Set
            </Button>
          </div>

          {state?.active && (
            <div className="flex items-center justify-between border-t pt-2">
              <span className="font-mono text-sm">
                {formatTime(state.remainingSeconds)} remaining
              </span>
              <Button variant="ghost" size="sm" onClick={cancelTimer}>
                <X className="mr-1 h-4 w-4" /> Cancel
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
