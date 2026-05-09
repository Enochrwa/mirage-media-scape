import React, { useMemo } from 'react';
import { FixedSizeGrid, type GridChildComponentProps } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
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
import { formatDuration } from '@/lib/utils';

interface LibraryGridProps {
  files: MediaFile[];
}

const LibraryGrid: React.FC<LibraryGridProps> = ({ files }) => {
  const { playFile } = usePlayerStore();

  const COLUMN_COUNT = 5;
  const ROW_COUNT = Math.ceil(files.length / COLUMN_COUNT);

  const Cell = ({
    columnIndex,
    rowIndex,
    style,
  }: GridChildComponentProps) => {
    const index = rowIndex * COLUMN_COUNT + columnIndex;
    const file = files[index];

    if (!file) return null;

    return (
      <div style={{ ...style, padding: '8px' }}>
        <Card className="group h-full overflow-hidden bg-card transition-colors hover:bg-card/80">
          <div className="relative aspect-square overflow-hidden">
            <img
              src={file.cover || '/placeholder.svg'}
              alt={file.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                size="icon"
                className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
                onClick={() => playFile(file)}
              >
                <Play className="ml-0.5 h-5 w-5" />
              </Button>
            </div>
            <div className="absolute right-2 top-2 rounded-full bg-black/60 p-1">
              {file.type === 'video' ? (
                <Film className="h-4 w-4 text-white" />
              ) : (
                <Music className="h-4 w-4 text-white" />
              )}
            </div>
            <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1 text-[10px] text-white">
              {formatDuration(file.duration || 0)}
            </div>
          </div>
          <div className="flex items-center justify-between p-3">
            <div className="mr-2 min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {file.artist || 'Unknown Artist'}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
  };

  return (
    <div className="h-[calc(100vh-250px)] w-full">
      <AutoSizer>
        {({ height, width }) => {
          const columnWidth = width / COLUMN_COUNT;
          const rowHeight = columnWidth + 80; // Aspect ratio + padding/text
          return (
            <FixedSizeGrid
              columnCount={COLUMN_COUNT}
              columnWidth={columnWidth}
              height={height}
              rowCount={ROW_COUNT}
              rowHeight={rowHeight}
              width={width}
            >
              {Cell}
            </FixedSizeGrid>
          );
        }}
      </AutoSizer>
    </div>
  );
};

export default LibraryGrid;
