import React, { memo, useEffect, useState } from 'react';
import { FixedSizeGrid as Grid, type GridChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { usePlayerStore } from '@/store/usePlayerStore';
import { MediaFile } from '@/types/media';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, MoreHorizontal, Film, Music } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDuration, formatVideoClock, cn } from '@/lib/utils';

interface LibraryGridProps {
  files: MediaFile[];
}

const ROW_HEIGHT = 288;
const MIN_COL_WIDTH = 168;
const MAX_COLS = 6;

type GridCellData = {
  files: MediaFile[];
  columnCount: number;
  playFile: (f: MediaFile) => void;
};

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
  columnIndex,
  rowIndex,
  style,
  data,
}: GridChildComponentProps<GridCellData>) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const { files, columnCount, playFile } = data;
  const index = rowIndex * columnCount + columnIndex;
  const file = index < files.length ? files[index] : null;
  const trackId = file?.id;

  useEffect(() => {
    setImgLoaded(false);
  }, [trackId]);

  if (!file) {
    return <div style={style} className="p-2" />;
  }

  const poster = file.type === 'video' ? (file.thumbnail ?? file.cover) : file.cover;
  const res = resolutionLabel(file);
  const fmt = formatBadgeLabel(file);

  return (
    <div style={style} className="box-border p-2">
      <Card className="group flex h-full flex-col overflow-hidden bg-card transition-colors hover:bg-card/80">
        <div className="relative aspect-square overflow-hidden bg-muted/40">
          <img
            src={poster || '/placeholder.svg'}
            alt={file.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            className={cn(
              'h-full w-full object-cover transition-all duration-300 group-hover:scale-105',
              imgLoaded ? 'opacity-100 blur-0' : 'opacity-70 blur-sm',
            )}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
              onClick={() => playFile(file)}
              aria-label={`Play ${file.title}`}
            >
              <Play className="ml-0.5 h-5 w-5" />
            </Button>
          </div>
          {file.type === 'video' && res ? (
            <div className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {res}
            </div>
          ) : null}
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
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {file.type === 'video'
              ? formatVideoClock(file.duration || 0)
              : formatDuration(file.duration || 0)}
          </div>
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
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => playFile(file)}>Play</DropdownMenuItem>
              <DropdownMenuItem>Add to Queue</DropdownMenuItem>
              <DropdownMenuItem>Add to Playlist</DropdownMenuItem>
              <DropdownMenuItem>Show in File Explorer</DropdownMenuItem>
              <DropdownMenuItem>Get Info</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </div>
  );
});

const LibraryGrid: React.FC<LibraryGridProps> = ({ files }) => {
  const playFile = usePlayerStore((s) => s.playFile);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="h-[min(75vh,820px)] min-h-[320px] w-full">
      <AutoSizer>
        {({ width, height }) => {
          const columnCount = Math.min(MAX_COLS, Math.max(2, Math.floor(width / MIN_COL_WIDTH)));
          const columnWidth = width / columnCount;
          const rowCount = Math.ceil(files.length / columnCount);
          const data: GridCellData = { files, columnCount, playFile };
          return (
            <Grid
              columnCount={columnCount}
              columnWidth={columnWidth}
              rowCount={rowCount}
              rowHeight={ROW_HEIGHT}
              width={width}
              height={height}
              overscanColumnCount={0}
              overscanRowCount={2}
              itemData={data}
            >
              {GridCell}
            </Grid>
          );
        }}
      </AutoSizer>
    </div>
  );
};

export default LibraryGrid;
