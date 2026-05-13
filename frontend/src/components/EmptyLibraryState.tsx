import React from 'react';
import { Button } from '@/components/ui/button';
import { FolderSearch, Music } from 'lucide-react';

interface EmptyLibraryStateProps {
  onAddFolder: () => void;
}

const EmptyLibraryState: React.FC<EmptyLibraryStateProps> = ({ onAddFolder }) => {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="relative mb-6">
        <FolderSearch className="h-24 w-24 text-muted-foreground/20" />
        <Music className="absolute -bottom-2 -right-2 h-10 w-10 text-primary" />
      </div>
      <h3 className="mb-2 text-2xl font-bold">No media found in the selected folders</h3>
      <p className="mb-8 max-w-sm text-muted-foreground">
        We couldn't find any supported audio or video files. Try adding different folders or
        checking your file extensions.
      </p>
      <div className="flex flex-col gap-3">
        <Button size="lg" onClick={onAddFolder}>
          Choose Different Folders
        </Button>
        <Button variant="link" className="text-xs text-muted-foreground">
          Add individual files
        </Button>
      </div>
    </div>
  );
};

export default EmptyLibraryState;
