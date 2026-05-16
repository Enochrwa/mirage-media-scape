import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MediaFile } from '@/types/media';
import { API_BASE } from '@/lib/utils';
import { toast } from 'sonner';
import { RefreshCw, Save } from 'lucide-react';

interface TrackInfoModalProps {
  track: MediaFile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (updated: Partial<MediaFile>) => void;
}

export const TrackInfoModal: React.FC<TrackInfoModalProps> = ({
  track,
  open,
  onOpenChange,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    title: track.title,
    artist: track.artist,
    album: track.album,
    bpm: track.bpm?.toString() || '',
    camelot_key: track.camelot_key || '',
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData({
      title: track.title,
      artist: track.artist,
      album: track.album,
      bpm: track.bpm?.toString() || '',
      camelot_key: track.camelot_key || '',
    });
  }, [track]);

  const handleReanalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/api/tracks/${track.id}/reanalyze`, { method: 'POST' });
      const data = await res.json();
      setFormData((prev) => ({
        ...prev,
        bpm: data.bpm.toFixed(1),
        camelot_key: data.camelot_key,
      }));
      toast.success('Analysis complete');
    } catch (e) {
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/tracks/${track.id}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          bpm: parseFloat(formData.bpm) || null,
        }),
      });
      if (res.ok) {
        toast.success('Metadata updated');
        onSave?.({
          ...formData,
          bpm: parseFloat(formData.bpm) || undefined,
        });
        onOpenChange(false);
      }
    } catch (e) {
      toast.error('Failed to update metadata');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Track Information</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="artist" className="text-right">
              Artist
            </Label>
            <Input
              id="artist"
              value={formData.artist}
              onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="album" className="text-right">
              Album
            </Label>
            <Input
              id="album"
              value={formData.album}
              onChange={(e) => setFormData({ ...formData, album: e.target.value })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bpm" className="text-right">
              BPM
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="bpm"
                value={formData.bpm}
                onChange={(e) => setFormData({ ...formData, bpm: e.target.value })}
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleReanalyze}
                disabled={isAnalyzing}
              >
                <RefreshCw className={isAnalyzing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="key" className="text-right">
              Key (Camelot)
            </Label>
            <Input
              id="key"
              value={formData.camelot_key}
              onChange={(e) => setFormData({ ...formData, camelot_key: e.target.value })}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save size={16} /> Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
