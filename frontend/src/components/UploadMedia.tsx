import React, { useState, useRef } from 'react';
import { useLibraryStore } from '@/store/useLibraryStore';
import { MediaFile, MediaType } from '@/types/media';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Upload, X, FileAudio, FileVideo, Image } from 'lucide-react';

interface UploadMediaProps {
  className?: string;
}

const UploadMedia: React.FC<UploadMediaProps> = ({ className }) => {
  const { addFile } = useLibraryStore();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('audio');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelect(file);
    }
  };

  const handleFileSelect = (file: File) => {
    const fileType = file.type;

    if (fileType.startsWith('audio/')) {
      setMediaType('audio');
      setSelectedFile(file);
    } else if (fileType.startsWith('video/')) {
      setMediaType('video');
      setSelectedFile(file);
    } else {
      toast({
        title: 'Unsupported File Type',
        description: 'Please select an audio or video file.',
        variant: 'destructive',
      });
    }
  };

  const handleCoverSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Unsupported File Type',
        description: 'Please select an image file for the cover.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedCoverFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setCoverPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a file to upload.',
        variant: 'destructive',
      });
      return;
    }

    if (!title) {
      toast({
        title: 'Title Required',
        description: 'Please enter a title for the media file.',
        variant: 'destructive',
      });
      return;
    }

    // Create object URL for the file
    const fileUrl = URL.createObjectURL(selectedFile);
    let coverUrl = coverPreview || '/placeholder.svg';

    if (selectedCoverFile) {
      coverUrl = URL.createObjectURL(selectedCoverFile);
    }

    const newFile: MediaFile = {
      id: `file-${Date.now()}`,
      title,
      artist: artist || undefined,
      album: album || undefined,
      cover: coverUrl,
      file: fileUrl,
      type: mediaType,
    };

    addFile(newFile);

    toast({
      title: 'File Uploaded Successfully',
      description: `${newFile.title} has been added to your library.`,
    });

    // Reset form
    setSelectedFile(null);
    setSelectedCoverFile(null);
    setTitle('');
    setArtist('');
    setAlbum('');
    setCoverPreview(null);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  const clearSelectedCover = () => {
    setSelectedCoverFile(null);
    setCoverPreview(null);
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Media</h1>
        <p className="mt-2 text-muted-foreground">
          Add your own music and video files to your library.
        </p>
      </div>

      <Card className="space-y-6 p-6">
        <div
          className={cn(
            'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
            dragActive ? 'border-accent bg-accent/10' : 'border-muted',
            selectedFile ? 'bg-secondary/30' : 'hover:bg-secondary/30',
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {selectedFile ? (
            <div className="flex flex-col items-center gap-2">
              {mediaType === 'audio' ? (
                <FileAudio className="h-12 w-12 text-accent" />
              ) : (
                <FileVideo className="h-12 w-12 text-accent" />
              )}
              <div className="flex items-center gap-2">
                <p className="text-lg font-medium">{selectedFile.name}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelectedFile();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">Drag and drop a file here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Supported formats: MP3, WAV, MP4, WEBM
              </p>
            </div>
          )}
          <Input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="audio/*,video/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter media title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="artist">Artist</Label>
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Enter artist name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="album">Album</Label>
              <Input
                id="album"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="Enter album name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="media-type">Type</Label>
              <Select value={mediaType} onValueChange={(value) => setMediaType(value as MediaType)}>
                <SelectTrigger id="media-type">
                  <SelectValue placeholder="Select media type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Cover Image</Label>
            <div
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors',
                coverPreview ? 'border-accent' : 'border-muted hover:bg-secondary/30',
              )}
              onClick={() => coverInputRef.current?.click()}
            >
              {coverPreview ? (
                <div className="relative w-full">
                  <img
                    src={coverPreview}
                    alt="Cover Preview"
                    className="h-48 w-full rounded-md object-cover"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-2 bg-black/50 hover:bg-black/70"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSelectedCover();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Image className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to add a cover image</p>
                </>
              )}
              <Input
                type="file"
                ref={coverInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleCoverSelect(e.target.files[0]);
                  }
                }}
              />
            </div>
          </div>
        </div>

        <Button className="w-full" onClick={handleUpload} disabled={!selectedFile || !title}>
          Upload
        </Button>
      </Card>
    </div>
  );
};

export default UploadMedia;
