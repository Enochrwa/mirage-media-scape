import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Moon, Heart, Smile, Brain, Music2, Coffee, Ghost } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';

const MOODS = [
  { id: 'focus', icon: <Brain size={24} />, label: 'Focus', color: 'text-blue-400' },
  { id: 'workout', icon: <Zap size={24} />, label: 'Workout', color: 'text-orange-400' },
  { id: 'sleep', icon: <Moon size={24} />, label: 'Sleep', color: 'text-indigo-400' },
  { id: 'party', icon: <Smile size={24} />, label: 'Party', color: 'text-yellow-400' },
  { id: 'chill', icon: <Coffee size={24} />, label: 'Chill', color: 'text-green-400' },
  { id: 'romance', icon: <Heart size={24} />, label: 'Romance', color: 'text-red-400' },
  { id: 'sad', icon: <Ghost size={24} />, label: 'Deep', color: 'text-purple-400' },
  { id: 'energy', icon: <Music2 size={24} />, label: 'Energy', color: 'text-pink-400' },
];

export const MoodDetector: React.FC = () => {
  const { playFile } = usePlayerStore();
  const { files } = useLibraryStore();
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    let detectedMood = '';
    if (hour >= 6 && hour < 10) detectedMood = 'energy';
    else if (hour >= 10 && hour < 17) detectedMood = 'focus';
    else if (hour >= 17 && hour < 22) detectedMood = 'chill';
    else detectedMood = 'sleep';

    const lastDismissed = localStorage.getItem('lastMoodDismissed');
    const today = new Date().toDateString();

    if (lastDismissed !== today) {
      setSuggestion(detectedMood);
    }
  }, []);

  const handleMoodSelect = async (moodId: string) => {
    // In a real implementation, this would fetch from /api/radio/mood
    console.log(`Mood selected: ${moodId}`);
    setSuggestion(null);
  };

  const dismiss = () => {
    localStorage.setItem('lastMoodDismissed', new Date().toDateString());
    setSuggestion(null);
  };

  return (
    <div className="space-y-6">
      {suggestion && (
        <Card className="flex items-center justify-between border-purple-500/50 bg-purple-500/10 p-4 duration-500 animate-in slide-in-from-top">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-500 p-2 text-white">
              <Smile size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                Good {new Date().getHours() < 12 ? 'morning' : 'day'}!
              </p>
              <p className="text-xs text-zinc-400">
                Ready for some <span className="font-semibold text-purple-400">{suggestion}</span>{' '}
                tracks?
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Dismiss
            </Button>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => handleMoodSelect(suggestion)}
            >
              Start
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MOODS.map((mood) => (
          <Card
            key={mood.id}
            onClick={() => handleMoodSelect(mood.id)}
            className="group flex cursor-pointer items-center gap-3 border-white/5 bg-zinc-900/50 p-4 transition-all hover:border-white/20 hover:bg-zinc-800"
          >
            <div className={cn('transition-transform group-hover:scale-110', mood.color)}>
              {mood.icon}
            </div>
            <span className="text-sm font-medium text-zinc-300 group-hover:text-white">
              {mood.label}
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
};
