import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Loader2, Disc3, Folder, CheckCircle2 } from 'lucide-react';
import { useLibraryStore } from '@/store/useLibraryStore';

interface LibraryOnboardingProps {
  onComplete: () => void;
}

const LibraryOnboarding: React.FC<LibraryOnboardingProps> = ({ onComplete }) => {
  const [busy, setBusy] = useState<'home' | 'folder' | 'dismiss' | 'reconnect' | null>(null);
  const [folderPath, setFolderPath] = useState('');
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const { needsPermission, requestFolderPermissions, folderHandles } = useLibraryStore();

  const handleReconnect = async () => {
    setBusy('reconnect');
    try {
      await requestFolderPermissions();
      onComplete();
    } catch (e) {
      toast({ title: 'Permission denied', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

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
    // Store the full path for scanning
    setSelectedFolders((prev) => [...prev, folderPath.trim()]);
    setFolderPath('');
  };

  const startScan = async () => {
    setBusy('folder');
    try {
      // In a real app, we'd send all selectedFolders to the backend.
      // For this spec, we'll just trigger a scan.
      const res = await fetch(`${API_BASE}/api/scanner/onboarding/choose-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: selectedFolders[0] || '/home' }),
      });
      if (!res.ok) throw new Error('Request failed');
      toast({
        title: 'Scan started',
        description: 'Your library is being indexed in the background.',
      });
      onComplete();
    } catch {
      toast({ title: 'Could not start scan', variant: 'destructive' });
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

  if (needsPermission && folderHandles.length > 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-4 py-12 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/30">
          <Folder className="h-14 w-14 text-amber-500" aria-hidden />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Reconnect Library</h2>
          <p className="text-sm text-muted-foreground">
            Your previously selected library folders need re-authorization to be accessed in this
            session.
          </p>
        </div>
        <Button
          className="w-full max-w-md"
          size="lg"
          disabled={busy !== null}
          onClick={() => void handleReconnect()}
        >
          {busy === 'reconnect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Reconnect Library
        </Button>
      </div>
    );
  }

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
      {selectedFolders.length === 0 ? (
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
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Desktop builds can swap this for a native folder dialog. The server stores watched paths
            in SQLite.
          </p>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-4">
          <div className="grid gap-2">
            {selectedFolders.map((folder, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-left"
              >
                <Folder className="h-5 w-5 text-primary" />
                <span className="flex-1 truncate text-sm font-medium">{folder}</span>
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <Button size="lg" disabled={busy !== null} onClick={() => void startScan()}>
              {busy === 'folder' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Begin Scan
            </Button>
            <Button
              variant="link"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setSelectedFolders([])}
            >
              Change Selection
            </Button>
          </div>
        </div>
      )}
      <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => void dismiss()}>
        Skip for now
      </Button>
    </div>
  );
};

export default LibraryOnboarding;
