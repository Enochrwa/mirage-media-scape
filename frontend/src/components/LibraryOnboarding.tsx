import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Loader2, Disc3 } from 'lucide-react';

interface LibraryOnboardingProps {
  onComplete: () => void;
}

const LibraryOnboarding: React.FC<LibraryOnboardingProps> = ({ onComplete }) => {
  const [busy, setBusy] = useState<'home' | 'folder' | 'dismiss' | null>(null);
  const [folderPath, setFolderPath] = useState('');

  const scanHome = async () => {
    setBusy('home');
    try {
      const res = await fetch(`${API_BASE}/api/scanner/onboarding/home`, { method: 'POST' });
      if (!res.ok) throw new Error('Request failed');
      toast({
        title: 'Scan started',
        description: 'Your home folder is being indexed in the background.',
      });
      onComplete();
    } catch {
      toast({ title: 'Could not start scan', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const chooseFolder = async () => {
    if (!folderPath.trim()) {
      toast({ title: 'Enter a folder path', variant: 'destructive' });
      return;
    }
    setBusy('folder');
    try {
      const res = await fetch(`${API_BASE}/api/scanner/onboarding/choose-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: folderPath.trim() }),
      });
      if (!res.ok) throw new Error('Request failed');
      toast({ title: 'Folder added', description: 'Library scan has started.' });
      onComplete();
    } catch {
      toast({ title: 'Could not add folder', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async () => {
    setBusy('dismiss');
    try {
      await fetch(`${API_BASE}/api/scanner/onboarding/dismiss`, { method: 'POST' });
      onComplete();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
        <Disc3 className="h-14 w-14 text-primary" aria-hidden />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Your world of media, instantly.</h2>
        <p className="text-sm text-muted-foreground">
          Add a library folder once. Tracks appear from cache immediately on every launch while we
          refresh in the background.
        </p>
      </div>
      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          className="sm:flex-1"
          size="lg"
          disabled={busy !== null}
          onClick={() => void scanHome()}
        >
          {busy === 'home' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Scan My Entire Computer
        </Button>
      </div>
      <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card/40 p-4 text-left">
        <Label htmlFor="folder-path">Choose folder (absolute path on this machine)</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="folder-path"
            placeholder="/home/you/Music"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            disabled={busy !== null}
          />
          <Button disabled={busy !== null} onClick={() => void chooseFolder()}>
            {busy === 'folder' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Desktop builds can swap this for a native folder dialog. The server stores watched paths
          in SQLite.
        </p>
      </div>
      <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => void dismiss()}>
        Skip for now
      </Button>
    </div>
  );
};

export default LibraryOnboarding;
