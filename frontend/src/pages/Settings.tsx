import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/theme-provider';
import MainLayout from '@/components/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Globe,
  Moon,
  Sun,
  User,
  Bell,
  Shield,
  Download,
  Save,
  Zap,
  Volume2,
  Database,
  Upload,
  FileJson,
  Trash2,
  Plus,
  X,
  Video,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { playbackEngine } from '@/lib/PlaybackEngine';
import { Badge } from '@/components/ui/badge';
import { useEffect } from 'react';
import { API_BASE, cn } from '@/lib/utils';
import { useCapability } from '@/platform';
import { usePlayerStore } from '@/store/usePlayerStore';

const Settings = () => {
  const { i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useState(i18n.language);
  const [notifications, setNotifications] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const [downloadQuality, setDownloadQuality] = useState('high');

  const [bassEnhancer, setBassEnhancer] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [crossfade, setCrossfade] = useState(2);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [replaygainMode, setReplaygainMode] = useState(
    localStorage.getItem('ZOVYRA_replaygain_mode') || 'track',
  );
  const [preamp, setPreamp] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [extensions, setExtensions] = useState([
    'mp3',
    'flac',
    'wav',
    'm4a',
    'ogg',
    'mp4',
    'mkv',
    'avi',
  ]);
  const [newExt, setNewExt] = useState('');
  const [hwSupport, setHwSupport] = useState<Record<string, boolean>>({});
  const [autoPiP, setAutoPiP] = useState(localStorage.getItem('ZOVYRA_auto_pip') === 'true');
  const canSendNativeNotifications = useCapability('canSendNativeNotifications');

  useEffect(() => {
    VideoDecodeEngine.probeHardwareDecode().then(setHwSupport);
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        setOutputDevices(devices.filter((d) => d.kind === 'audiooutput'));
      });
      navigator.mediaDevices.ondevicechange = () => {
        navigator.mediaDevices.enumerateDevices().then((devices) => {
          setOutputDevices(devices.filter((d) => d.kind === 'audiooutput'));
        });
      };
    }
  }, []);

  const handleExport = async () => {
    const res = await fetch(`${API_BASE}/api/settings/export`);
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZOVYRA_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleSaveSettings = () => {
    toast({
      title: 'Settings saved',
      description: 'Your settings have been updated successfully.',
    });
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="mb-1 text-4xl font-bold uppercase tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Customize your zovyra experience.</p>
        </div>

        <Tabs defaultValue="playback" className="w-full">
          <TabsList className="mb-6 grid max-w-4xl grid-cols-8">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="playback">Playback</TabsTrigger>
            <TabsTrigger value="video">Video</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>

          <TabsContent value="video" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Video Engine
                </CardTitle>
                <CardDescription>Hardware acceleration and playback behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-PiP on navigate</Label>
                    <p className="text-xs text-muted-foreground">Automatically trigger Picture-in-Picture when leaving the player page</p>
                  </div>
                  <Switch
                    checked={autoPiP}
                    onCheckedChange={(v) => {
                      setAutoPiP(v);
                      localStorage.setItem('ZOVYRA_auto_pip', v.toString());
                    }}
                  />
                </div>

                <div className="pt-4 border-t border-white/5">
                  <Label className="mb-3 block">Hardware Acceleration Status</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(hwSupport).map(([codec, supported]) => (
                      <div key={codec} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                        <span className="text-sm font-medium uppercase">{codec}</span>
                        {supported ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-zinc-500">Software</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="playback" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Audio Engine
                </CardTitle>
                <CardDescription>Advanced audio processing and transitions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base">Bass Enhancer</Label>
                    <p className="text-sm text-muted-foreground">
                      Harmonic exciter for warmer low-end
                    </p>
                  </div>
                  <Switch
                    checked={bassEnhancer}
                    onCheckedChange={(v) => {
                      setBassEnhancer(v);
                      playbackEngine.setBassEnhancerEnabled(v);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base">Night Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Dynamic range compression for quiet listening
                    </p>
                  </div>
                  <Switch
                    checked={nightMode}
                    onCheckedChange={(v) => {
                      setNightMode(v);
                      playbackEngine.setNightModeEnabled(v);
                    }}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label className="text-base">Crossfade Duration</Label>
                    <span className="font-mono text-primary">{crossfade}s</span>
                  </div>
                  <Slider
                    value={[crossfade]}
                    onValueChange={(v) => {
                      setCrossfade(v[0]);
                      playbackEngine.setGlobalCrossfadeDuration(v[0] * 1000);
                    }}
                    max={12}
                    step={0.5}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn('mt-2 w-full', isPreviewing && 'bg-primary/20')}
                    disabled={isPreviewing}
                    onClick={async () => {
                      const { currentFile, currentTime } = usePlayerStore.getState();
                      if (currentFile) {
                        setIsPreviewing(true);
                        // Play a 4s snippet to hear crossfade-like start/end
                        await playbackEngine.samplePreview(currentFile, currentTime, 4000);
                        setIsPreviewing(false);
                      } else {
                        toast({
                          title: 'No track playing',
                          description: 'Play a track first to preview.',
                        });
                      }
                    }}
                  >
                    {isPreviewing ? 'Previewing...' : 'Preview Crossfade Effect'}
                  </Button>
                </div>

                <div className="space-y-4 border-t border-white/5 pt-6">
                  <Label className="text-base">ReplayGain Mode</Label>
                  <Select
                    value={replaygainMode}
                    onValueChange={(v) => {
                      setReplaygainMode(v);
                      localStorage.setItem('ZOVYRA_replaygain_mode', v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="track">Track</SelectItem>
                      <SelectItem value="album">Album</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-sm">Pre-amp</Label>
                      <span className="font-mono text-xs">
                        {preamp > 0 ? '+' : ''}
                        {preamp} dB
                      </span>
                    </div>
                    <Slider
                      value={[preamp]}
                      onValueChange={(v) => {
                        setPreamp(v[0]);
                        playbackEngine.setPreAmp(v[0]);
                      }}
                      min={-6}
                      max={6}
                      step={0.5}
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t border-white/5 pt-6">
                  <div className="flex justify-between">
                    <Label className="text-base">Global Playback Speed</Label>
                    <span className="font-mono text-primary">{playbackSpeed.toFixed(2)}x</span>
                  </div>
                  <Slider
                    value={[playbackSpeed]}
                    onValueChange={(v) => {
                      setPlaybackSpeed(v[0]);
                      playbackEngine.setPlaybackRate(v[0]);
                    }}
                    min={0.25}
                    max={4.0}
                    step={0.05}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-base">Audio Output Device</Label>
                  <Select
                    value={selectedDevice}
                    onValueChange={(v) => {
                      setSelectedDevice(v);
                      // @ts-expect-error - setSinkId is experimental
                      if (playbackEngine.ctx.setSinkId) playbackEngine.ctx.setSinkId(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {outputDevices.map((d) => (
                        <SelectItem key={d.deviceId} value={d.deviceId}>
                          {d.label || 'Unknown Device'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* @ts-expect-error - setSinkId is experimental */}
                  {!playbackEngine.ctx.setSinkId && (
                    <p className="text-[10px] text-amber-500">(Not supported in this browser)</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Language
                </CardTitle>
                <CardDescription>
                  Select your preferred language for the application interface
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div className="grid gap-3">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={language}
                      onValueChange={(value) => {
                        i18n.changeLanguage(value);
                        setLanguage(value);
                      }}
                    >
                      <SelectTrigger id="language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="kin">Kinyarwanda</SelectItem>
                        <SelectItem value="sw">Kiswahili</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Media Settings
                </CardTitle>
                <CardDescription>
                  Configure default media playback and download settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoplay">Autoplay media</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically play media when selected
                      </p>
                    </div>
                    <Switch id="autoplay" checked={autoplay} onCheckedChange={setAutoplay} />
                  </div>

                  <div className="grid gap-3">
                    <Label htmlFor="quality">Download quality</Label>
                    <Select value={downloadQuality} onValueChange={setDownloadQuality}>
                      <SelectTrigger id="quality">
                        <SelectValue placeholder="Select quality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low (faster)</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High (best quality)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  Theme
                </CardTitle>
                <CardDescription>Customize the appearance of the application</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div className="grid gap-3">
                    <Label htmlFor="theme">Theme mode</Label>
                    <Select
                      value={theme}
                      onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
                    >
                      <SelectTrigger id="theme">
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>Manage your account details and preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div className="grid gap-3">
                    <Label htmlFor="name">Display Name</Label>
                    <Input id="name" placeholder="Your name" defaultValue="User" />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" placeholder="Your email" defaultValue="user@example.com" />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveSettings} className="ml-auto flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Settings
                </CardTitle>
                <CardDescription>Control how and when you receive notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notifications">Enable notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications about new uploads and features
                      </p>
                    </div>
                    {canSendNativeNotifications ? (
                      <Switch
                        id="notifications"
                        checked={notifications}
                        onCheckedChange={setNotifications}
                      />
                    ) : (
                      <Badge variant="outline">Not supported</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="library" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" /> Library Scan Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>File extensions to scan</Label>
                  <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                    {extensions.map((ext) => (
                      <Badge key={ext} variant="secondary" className="gap-1 pr-1">
                        .{ext}
                        <button
                          onClick={() => setExtensions(extensions.filter((e) => e !== ext))}
                          className="hover:text-red-400"
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                    <div className="ml-2 flex items-center gap-1">
                      <Input
                        value={newExt}
                        onChange={(e) => setNewExt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setExtensions([...extensions, newExt]);
                            setNewExt('');
                          }
                        }}
                        placeholder="add..."
                        className="h-6 w-20 border-none bg-transparent p-0 text-xs focus-visible:ring-0"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          setExtensions([...extensions, newExt]);
                          setNewExt('');
                        }}
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="h-5 w-5" /> Data Management
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2 border-white/10 hover:bg-white/5"
                  onClick={handleExport}
                >
                  <Download className="h-6 w-6 text-purple-400" />
                  <div className="text-center">
                    <p className="font-bold">Export All Data</p>
                    <p className="text-[10px] text-zinc-500">Metadata, ratings, and stats</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2 border-white/10 hover:bg-white/5"
                >
                  <Upload className="h-6 w-6 text-blue-400" />
                  <div className="text-center">
                    <p className="font-bold">Import Data</p>
                    <p className="text-[10px] text-zinc-500">Restore from JSON backup</p>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy Controls
                </CardTitle>
                <CardDescription>Manage your data and privacy settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="analytics">Usage Analytics</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow anonymous usage data collection to improve the application
                      </p>
                    </div>
                    <Switch id="analytics" defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Settings;
