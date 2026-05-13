import React from 'react';
import { Button } from '@/components/ui/button';
import { FolderSearch, Music } from 'lucide-react';

interface EmptyLibraryStateProps {
  onAddFolder: () => void;
}

const EmptyLibraryState: React.FC<EmptyLibraryStateProps> = ({ onAddFolder }) => {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
      <div className="relative mb-6">
        <FolderSearch className="w-24 h-24 text-muted-foreground/20" />
        <Music className="w-10 h-10 text-primary absolute -bottom-2 -right-2" />
      </div>
      <h3 className="text-2xl font-bold mb-2">No media found in the selected folders</h3>
      <p className="text-muted-foreground max-w-sm mb-8">
        We couldn't find any supported audio or video files. Try adding different folders or checking your file extensions.
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
