import React, { memo, useEffect, useState, useCallback, useRef } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { MediaFile } from '@/types/media';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Play,
  MoreHorizontal,
  Film,
  Music,
  Link2Off,
  Trash2,
  Plus,
  ListPlus,
  Download,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDuration, formatVideoClock, cn } from '@/lib/utils';
import { TrackInfoModal } from './tracks/TrackInfoModal';

interface LibraryGridProps {
  files: MediaFile[];
}

interface GridCellProps {
  file: MediaFile;
  playFile: (f: MediaFile) => void;
  selection: Set<string>;
  toggleSelection: (id: string) => void;
}

function formatBadgeLabel(file: MediaFile): string {
  const p = file.file_path || '';
  const i = p.lastIndexOf('.');
  if (i === -1) return '';
  return p.slice(i + 1).toUpperCase();
}

function resolutionLabel(file: MediaFile): string | null {
  const w = file.width;
  const h = file.height;
  if (!w || !h) return null;
  if (w >= 3840 || h >= 3840) return '4K';
  if (w >= 1920 || h >= 1920) return '1080p';
  if (w >= 1280 || h >= 1280) return '720p';
  return `${w}p`;
}

const GridCell = memo(function GridCell({
  file,
  playFile,
  selection,
  toggleSelection,
}: GridCellProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const trackId = file?.id;
  const isSelected = trackId ? selection.has(trackId) : false;
  const inSelectionMode = selection.size > 0;
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    setImgLoaded(false);
    if (!imgRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' },
    );
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [trackId]);

  const poster = file.type === 'video' ? (file.thumbnail ?? file.cover) : file.cover;
  const res = resolutionLabel(file);
  const fmt = formatBadgeLabel(file);
  const isMissing = (file as unknown as { missing?: number }).missing === 1;
  const dominantColor =
    (file as unknown as { dominant_color?: string }).dominant_color || '#2a2a2a';

  return (
    <div
      className="box-border p-2"
      onClick={(e) => {
        if (inSelectionMode || e.shiftKey) {
          e.preventDefault();
          toggleSelection(file.id);
        }
      }}
    >
      <Card
        className={cn(
          'group relative flex flex-col overflow-hidden bg-card transition-colors hover:bg-card/80',
          'h-48 sm:h-56 md:h-64',
          isSelected && 'bg-primary/5 ring-2 ring-primary',
          isMissing && 'opacity-60',
        )}
      >
        <div
          className="shimmer-bg relative aspect-square overflow-hidden"
          style={{ backgroundColor: imgLoaded ? 'transparent' : dominantColor }}
        >
          <img
            ref={imgRef}
            src={shouldLoad ? poster || '/placeholder.svg' : undefined}
            alt={file.title}
            onLoad={() => setImgLoaded(true)}
            className={cn(
              'h-full w-full object-cover transition-all duration-300 group-hover:scale-105',
              imgLoaded ? 'opacity-100 fade-in' : 'opacity-0',
            )}
          />

          {(inSelectionMode || isSelected) && (
            <div className="absolute left-2 top-2 z-10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelection(file.id)}
                className="h-5 w-5 bg-background/80"
              />
            </div>
          )}

          {!inSelectionMode && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                size="icon"
                className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isMissing) playFile(file);
                }}
                aria-label={`Play ${file.title}`}
              >
                <Play className="ml-0.5 h-5 w-5" />
              </Button>
            </div>
          )}
          {file.type === 'video' && res ? (
            <div className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {res}
            </div>
          ) : null}
          {isMissing && (
            <div className="absolute bottom-2 right-2 rounded-full bg-destructive/80 p-1">
              <Link2Off className="h-3 w-3 text-white" />
            </div>
          )}
          {fmt ? (
            <div className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
              {fmt}
            </div>
          ) : null}
          <div className="absolute bottom-2 left-2 rounded-full bg-black/60 p-1">
            {file.type === 'video' ? (
              <Film className="h-4 w-4 text-white" aria-hidden />
            ) : (
              <Music className="h-4 w-4 text-white" aria-hidden />
            )}
          </div>
          {!isMissing && (
            <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
              {file.type === 'video'
                ? formatVideoClock(file.duration || 0)
                : formatDuration(file.duration || 0)}
            </div>
          )}
        </div>
        <div className="flex min-h-[52px] flex-1 items-center justify-between gap-2 p-3">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="min-w-0 flex-1 cursor-default text-left">
                  <p className="truncate text-sm font-medium">{file.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {file.artist || 'Unknown Artist'}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-medium">{file.title}</p>
                <p className="text-xs text-muted-foreground">{file.artist || 'Unknown Artist'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                aria-label="More actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={isMissing}
                onClick={(e) => {
                  e.stopPropagation();
                  playFile(file);
                }}
              >
                Play
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Add to Queue</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                Add to Playlist
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                Show in File Explorer
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInfo(true);
                }}
              >
                Get Info
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  // Implement Rust trash call
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
      {showInfo && file && (
        <TrackInfoModal
          track={file}
          open={showInfo}
          onOpenChange={setShowInfo}
          onSave={(updated) => {
            Object.assign(file, updated);
          }}
        />
      )}
    </div>
  );
});

const LibraryGrid: React.FC<LibraryGridProps> = ({ files }) => {
  const playFile = usePlayerStore((s) => s.playFile);
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelection(new Set());
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {files.map((file) => (
          <GridCell
            key={file.id}
            file={file}
            playFile={playFile}
            selection={selection}
            toggleSelection={toggleSelection}
          />
        ))}
      </div>

      {selection.size > 0 && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-border bg-background/95 px-6 py-3 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-bottom-4">
          <span className="text-sm font-semibold">{selection.size} selected</span>
          <div className="mx-2 h-6 w-px bg-border" />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="gap-2">
              <Play className="h-4 w-4" /> Play All
            </Button>
            <Button variant="ghost" size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add to Queue
            </Button>
            <Button variant="ghost" size="sm" className="gap-2">
              <ListPlus className="h-4 w-4" /> Add to Playlist
            </Button>
            <Button variant="ghost" size="sm" className="gap-2">
              <Download className="h-4 w-4" /> Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 text-muted-foreground"
            onClick={() => setSelection(new Set())}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};

export default LibraryGrid;
