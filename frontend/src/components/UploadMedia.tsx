import React, { useState, useRef } from 'react';
import { useLibraryStore } from '@/store/useLibraryStore';
import { MediaType } from '@/types/media';
import { cn, API_BASE } from '@/lib/utils';
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
import { Upload, X, FileAudio, FileVideo, Image, Loader2 } from 'lucide-react';
import axios from 'axios';

interface UploadMediaProps {
  className?: string;
}

const UploadMedia: React.FC<UploadMediaProps> = ({ className }) => {
  const { fetchTracks } = useLibraryStore();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('audio');
  const [isPublic, setIsPublic] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('audio/')) setMediaType('audio');
    else if (file.type.startsWith('video/')) setMediaType('video');
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title);
    formData.append('artist', artist);
    formData.append('album', album);
    formData.append('isPublic', String(isPublic));

    try {
      await axios.post(`${API_BASE}/api/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 100),
          );
          setProgress(percentCompleted);
        },
      });

      toast({ title: 'Success', description: 'File uploaded successfully' });
      fetchTracks();
      setSelectedFile(null);
      setTitle('');
      setArtist('');
      setAlbum('');
      setProgress(0);
    } catch (err: unknown) {
      const errorMessage = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Unknown error';

      toast({
        title: 'Upload failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
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
                <X
                  className="h-4 w-4 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                />
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
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="audio/*,video/*"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
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
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="media-type">Type</Label>
              <Select value={mediaType} onValueChange={(v) => setMediaType(v as MediaType)}>
                <SelectTrigger id="media-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <input
                type="checkbox"
                id="public"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-800"
              />
              <Label htmlFor="public">Make Public (share with other users)</Label>
            </div>
          </div>
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs text-zinc-400">Uploading: {progress}%</p>
          </div>
        )}

        <Button className="w-full" onClick={handleUpload} disabled={!selectedFile || uploading}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Upload'}
        </Button>
      </Card>
    </div>
  );
};

export default UploadMedia;
