import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Save } from 'lucide-react';
import { API_BASE } from '@/lib/utils';
import { Playlist, SmartPlaylistCondition, SmartPlaylistOperator } from '@/types/media';

interface SmartPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (playlist: Playlist) => void;
}

const FIELDS = [
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
  { value: 'genre', label: 'Genre' },
  { value: 'bpm', label: 'BPM' },
  { value: 'added_at', label: 'Date Added' },
  { value: 'year', label: 'Year' },
  { value: 'duration', label: 'Duration (sec)' },
  { value: 'key', label: 'Key' },
  { value: 'camelot_key', label: 'Camelot Key' },
  { value: 'play_count', label: 'Play Count' },
  { value: 'last_played', label: 'Last Played' },
];

const OPERATORS = [
  { value: 'is', label: 'is' },
  { value: 'isNot', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'does not contain' },
  { value: 'gt', label: 'is greater than' },
  { value: 'lt', label: 'is less than' },
  { value: 'gte', label: 'is greater than or equal' },
  { value: 'lte', label: 'is less than or equal' },
  { value: 'inLastDays', label: 'in the last (days)' },
];

export const SmartPlaylistModal: React.FC<SmartPlaylistModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');
  const [conditions, setConditions] = useState<SmartPlaylistCondition[]>([
    { field: 'title', operator: 'contains', value: '' },
  ]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const addCondition = () => {
    setConditions([...conditions, { field: 'title', operator: 'contains', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<SmartPlaylistCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates } as SmartPlaylistCondition;
    setConditions(newConditions);
    fetchPreview(newConditions, matchMode);
  };

  const fetchPreview = async (conds: SmartPlaylistCondition[], mode: 'all' | 'any') => {
    try {
      const res = await fetch(`${API_BASE}/api/playlists/smart/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditions: conds, matchMode: mode }),
      });
      if (res.ok) {
        const { count } = (await res.json()) as { count: number };
        setPreviewCount(count);
      }
    } catch (error) {
      console.error('Failed to fetch preview', error);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    const playlist = {
      name,
      definition: {
        matchMode,
        conditions,
      },
    };

    try {
      const response = await fetch(`${API_BASE}/api/playlists/smart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playlist),
      });
      if (response.ok) {
        const data = (await response.json()) as Playlist;
        onSave(data);
        onClose();
      }
    } catch (error) {
      console.error('Failed to save smart playlist:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-zinc-800 bg-zinc-900 text-white sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle>Create Smart Playlist</DialogTitle>
            {previewCount !== null && (
              <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs font-bold text-purple-400">
                {previewCount} tracks match
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Playlist Name</Label>
            <Input
              placeholder="My Awesome Mix"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-zinc-700 bg-zinc-800 focus:ring-purple-500"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Rules</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">Match</span>
                <Select value={matchMode} onValueChange={(v: 'all' | 'any') => setMatchMode(v)}>
                  <SelectTrigger className="w-24 border-zinc-700 bg-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">all</SelectItem>
                    <SelectItem value="any">any</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-zinc-400">of these rules:</span>
              </div>
            </div>

            {conditions.map((condition, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={condition.field}
                  onValueChange={(v) => updateCondition(index, { field: v })}
                >
                  <SelectTrigger className="flex-1 border-zinc-700 bg-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELDS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={condition.operator}
                  onValueChange={(v) => updateCondition(index, { operator: v as SmartPlaylistOperator })}
                >
                  <SelectTrigger className="flex-1 border-zinc-700 bg-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Value..."
                  value={condition.value as string}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                  className="flex-1 border-zinc-700 bg-zinc-800"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCondition(index)}
                  disabled={conditions.length === 1}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={addCondition}
              className="w-full border-dashed border-zinc-700 hover:bg-zinc-800"
            >
              <Plus size={16} className="mr-2" />
              Add Rule
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">
            <Save size={16} className="mr-2" />
            Save Playlist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
