import React, { useMemo } from 'react';
import * as Grid from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { MediaFile, useMedia } from '@/contexts/MediaContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, MoreHorizontal, Film, Music } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDuration } from '@/lib/utils';

interface LibraryGridProps {
  files: MediaFile[];
}

const LibraryGrid: React.FC<LibraryGridProps> = ({ files }) => {
  const { playFile } = useMedia();

  const COLUMN_COUNT = 5;
  const ROW_COUNT = Math.ceil(files.length / COLUMN_COUNT);

  const Cell = ({ columnIndex, rowIndex, style }: { columnIndex: number, rowIndex: number, style: React.CSSProperties }) => {
    const index = rowIndex * COLUMN_COUNT + columnIndex;
    const file = files[index];

    if (!file) return null;

    return (
      <div style={{ ...style, padding: '8px' }}>
        <Card className="group overflow-hidden bg-card hover:bg-card/80 transition-colors h-full">
          <div className="relative aspect-square overflow-hidden">
            <img
              src={file.cover || '/placeholder.svg'}
              alt={file.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                size="icon"
                className="rounded-full bg-primary hover:bg-primary/90 w-12 h-12"
                onClick={() => playFile(file)}
              >
                <Play className="h-5 w-5 ml-0.5" />
              </Button>
            </div>
            <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
              {file.type === 'video' ? <Film className="h-4 w-4 text-white" /> : <Music className="h-4 w-4 text-white" />}
            </div>
            <div className="absolute bottom-2 right-2 bg-black/60 rounded px-1 text-[10px] text-white">
                {formatDuration(file.duration || 0)}
            </div>
          </div>
          <div className="p-3 flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-2">
              <p className="font-medium truncate text-sm">{file.title}</p>
              <p className="text-xs text-muted-foreground truncate">{file.artist || 'Unknown Artist'}</p>
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
            const { FixedSizeGrid } = Grid as any;
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
