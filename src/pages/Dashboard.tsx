
import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useMedia, MediaFile } from '@/contexts/MediaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Music, 
  Film, 
  Upload, 
  Trash2, 
  Edit, 
  Search, 
  ListMusic, 
  Heart, 
  Play, 
  FileType, 
  Clock,
  Filter,
  Download,
  Share2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "@/hooks/use-toast";

// Helper function to format file size
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to format duration
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const Dashboard = () => {
  const { files, playFile } = useMedia();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [sortField, setSortField] = useState('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'video'>('all');
  
  const audioFiles = files.filter(file => file.type === 'audio');
  const videoFiles = files.filter(file => file.type === 'video');
  
  // Filter files based on search term and type
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (file.artist && file.artist.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === 'all' || file.type === filterType;
    
    return matchesSearch && matchesType;
  });
  
  // Sort files
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    let valueA: any = a[sortField as keyof MediaFile] || '';
    let valueB: any = b[sortField as keyof MediaFile] || '';
    
    if (typeof valueA === 'string') valueA = valueA.toLowerCase();
    if (typeof valueB === 'string') valueB = valueB.toLowerCase();
    
    if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
    if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });
  
  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };
  
  const toggleFileSelection = (id: string) => {
    setSelectedFiles(prev => 
      prev.includes(id) 
        ? prev.filter(fileId => fileId !== id)
        : [...prev, id]
    );
  };
  
  const toggleSelectAll = () => {
    if (selectedFiles.length === sortedFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(sortedFiles.map(file => file.id));
    }
  };
  
  const handleBulkAction = (action: 'delete' | 'download' | 'share') => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to perform this action",
        variant: "destructive",
      });
      return;
    }
    
    switch (action) {
      case 'delete':
        toast({
          title: "Files Deleted",
          description: `${selectedFiles.length} files have been removed`,
        });
        break;
      case 'download':
        toast({
          title: "Downloading Files",
          description: `${selectedFiles.length} files will be downloaded`,
        });
        break;
      case 'share':
        toast({
          title: "Share Links Generated",
          description: `Links for ${selectedFiles.length} files are ready to share`,
        });
        break;
    }
    
    setSelectedFiles([]);
  };
  
  // Calculate stats
  const totalStorage = files.reduce((acc, file) => acc + (file.size || 0), 0);
  const totalDuration = files.reduce((acc, file) => acc + (file.duration || 0), 0);
  
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Media Dashboard</h1>
            <p className="text-muted-foreground">Manage and organize your media library</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="flex items-center gap-2" onClick={() => window.location.href = '/upload'}>
              <Upload className="h-4 w-4" />
              Upload New Media
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Media</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{files.length}</div>
                <FileType className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {audioFiles.length} audio files, {videoFiles.length} video files
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{formatFileSize(totalStorage)}</div>
                <Download className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Average file size: {formatFileSize(totalStorage / (files.length || 1))}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                  {Math.floor(totalDuration / 3600)}h {Math.floor((totalDuration % 3600) / 60)}m
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {files.length} files, {formatDuration(totalDuration)} total
              </p>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="list" className="w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="grid">Grid View</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            </TabsList>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search media..."
                  className="pl-9 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={filterType} onValueChange={(value) => setFilterType(value as any)}>
                <SelectTrigger className="w-full sm:w-40">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Filter" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="audio">Audio Only</SelectItem>
                  <SelectItem value="video">Video Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <TabsContent value="list" className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedFiles.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => handleBulkAction('delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => handleBulkAction('download')}
                  >
                    <Download className="h-4 w-4" />
                    Download Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => handleBulkAction('share')}
                  >
                    <Share2 className="h-4 w-4" />
                    Share Selected
                  </Button>
                </>
              )}
            </div>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={selectedFiles.length === sortedFiles.length && sortedFiles.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('type')}>
                      Type {sortField === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('title')}>
                      Title {sortField === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('artist')}>
                      Artist {sortField === 'artist' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('duration')}>
                      Duration {sortField === 'duration' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('size')}>
                      Size {sortField === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFiles.length > 0 ? (
                    sortedFiles.map((file) => (
                      <TableRow key={file.id} className="group">
                        <TableCell>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={selectedFiles.includes(file.id)}
                            onChange={() => toggleFileSelection(file.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {file.type === 'audio' ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                              <Music className="h-3 w-3 mr-1" />
                              Audio
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                              <Film className="h-3 w-3 mr-1" />
                              Video
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{file.title}</TableCell>
                        <TableCell>{file.artist || 'Unknown'}</TableCell>
                        <TableCell>{file.duration ? formatDuration(file.duration) : 'Unknown'}</TableCell>
                        <TableCell>{file.size ? formatFileSize(file.size) : 'Unknown'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => playFile(file)}>
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No media files found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="grid" className="space-y-4">
            {sortedFiles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {sortedFiles.map(file => (
                  <Card key={file.id} className="overflow-hidden group cursor-pointer hover:shadow-md transition-all">
                    <div className="aspect-square relative">
                      <input
                        type="checkbox"
                        className="absolute top-2 left-2 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary z-10"
                        checked={selectedFiles.includes(file.id)}
                        onChange={() => toggleFileSelection(file.id)}
                      />
                      <img 
                        src={file.cover || '/placeholder.svg'} 
                        alt={file.title} 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 transition-opacity">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="rounded-full h-9 w-9 p-0" 
                          onClick={(e) => {
                            e.stopPropagation();
                            playFile(file);
                          }}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="rounded-full h-9 w-9 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="rounded-full h-9 w-9 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="absolute top-2 right-2">
                        {file.type === 'audio' ? (
                          <Badge className="bg-blue-500/80">
                            <Music className="h-3 w-3 mr-1" />
                            Audio
                          </Badge>
                        ) : (
                          <Badge className="bg-purple-500/80">
                            <Film className="h-3 w-3 mr-1" />
                            Video
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <p className="font-medium truncate">{file.title}</p>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <p className="truncate">{file.artist || 'Unknown'}</p>
                        <p>{file.duration ? formatDuration(file.duration) : ''}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No media files found.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart className="h-5 w-5" />
                    Media Type Distribution
                  </CardTitle>
                  <CardDescription>Breakdown of your media library by type</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Music className="h-4 w-4 text-blue-500" />
                          <span>Audio Files</span>
                        </div>
                        <span className="font-medium">{audioFiles.length}</span>
                      </div>
                      <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full" 
                          style={{ 
                            width: `${files.length ? (audioFiles.length / files.length) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Film className="h-4 w-4 text-purple-500" />
                          <span>Video Files</span>
                        </div>
                        <span className="font-medium">{videoFiles.length}</span>
                      </div>
                      <div className="h-2 w-full bg-purple-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full" 
                          style={{ 
                            width: `${files.length ? (videoFiles.length / files.length) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Storage Utilization
                  </CardTitle>
                  <CardDescription>Breakdown of storage usage by media type</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Music className="h-4 w-4 text-blue-500" />
                          <span>Audio Storage</span>
                        </div>
                        <span className="font-medium">
                          {formatFileSize(audioFiles.reduce((acc, file) => acc + (file.size || 0), 0))}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full" 
                          style={{ 
                            width: `${totalStorage ? 
                              (audioFiles.reduce((acc, file) => acc + (file.size || 0), 0) / totalStorage) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Film className="h-4 w-4 text-purple-500" />
                          <span>Video Storage</span>
                        </div>
                        <span className="font-medium">
                          {formatFileSize(videoFiles.reduce((acc, file) => acc + (file.size || 0), 0))}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-purple-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full" 
                          style={{ 
                            width: `${totalStorage ? 
                              (videoFiles.reduce((acc, file) => acc + (file.size || 0), 0) / totalStorage) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
