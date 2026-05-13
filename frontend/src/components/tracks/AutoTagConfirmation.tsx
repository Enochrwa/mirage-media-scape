import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MatchData {
  title: string;
  artist: string;
  album: string;
  year?: number;
  confidence: number;
}

interface AutoTagConfirmationProps {
  current: Record<string, string | number | undefined>;
  suggested: MatchData;
  onApply: (fields: string[]) => void;
  onCancel: () => void;
}

export const AutoTagConfirmation: React.FC<AutoTagConfirmationProps> = ({
  current,
  suggested,
  onApply,
  onCancel,
}) => {
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'title',
    'artist',
    'album',
    'year',
  ]);
  const isLowConfidence = suggested.confidence < 0.6;

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg overflow-hidden border-white/10 bg-zinc-900 animate-in zoom-in-95">
        <div className="border-b border-white/5 p-6">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xl font-bold">
              {isLowConfidence ? (
                <AlertTriangle className="text-amber-500" />
              ) : (
                <CheckCircle2 className="text-green-500" />
              )}
              Match Found ({Math.round(suggested.confidence * 100)}%)
            </h3>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X size={20} />
            </Button>
          </div>
          {isLowConfidence && (
            <p className="mt-2 text-xs text-amber-500">
              Low confidence match — verify before applying.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-8 p-6">
          <div className="space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Current
            </span>
            <div className="space-y-3">
              <div className="text-sm">
                <p className="text-[10px] text-zinc-500">Title</p>
                <p className="truncate">{current.title || 'Unknown'}</p>
              </div>
              <div className="text-sm">
                <p className="text-[10px] text-zinc-500">Artist</p>
                <p className="truncate">{current.artist || 'Unknown'}</p>
              </div>
              <div className="text-sm">
                <p className="text-[10px] text-zinc-500">Album</p>
                <p className="truncate">{current.album || 'Unknown'}</p>
              </div>
              <div className="text-sm">
                <p className="text-[10px] text-zinc-500">Year</p>
                <p className="truncate">{current.year || '—'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
              Suggested
            </span>
            <div className="space-y-3">
              {['title', 'artist', 'album', 'year'].map((field) => (
                <div
                  key={field}
                  className="group flex cursor-pointer items-start gap-2"
                  onClick={() => toggleField(field)}
                >
                  <Checkbox checked={selectedFields.includes(field)} className="mt-1" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-[10px] capitalize text-zinc-500">{field}</p>
                    <p
                      className={cn(
                        'truncate',
                        selectedFields.includes(field)
                          ? 'font-medium text-purple-400'
                          : 'text-zinc-500',
                      )}
                    >
                      {(suggested as unknown as Record<string, string | number>)[field] || '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 bg-white/5 p-4">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-purple-600 hover:bg-purple-700"
            onClick={() => onApply(selectedFields)}
          >
            Apply Selection
          </Button>
        </div>
      </Card>
    </div>
  );
};
