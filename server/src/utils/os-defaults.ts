import os from 'os';
import path from 'path';
import fs from 'fs';

export function getOSMediaDirectories(): string[] {
  const home = os.homedir();
  const platform = process.platform;
  const candidates: string[] = [];

  if (platform === 'darwin') {
    candidates.push(
      path.join(home, 'Music'),
      path.join(home, 'Movies'),
      path.join(home, 'Downloads'),
      path.join(home, 'Desktop'),
    );
  } else if (platform === 'win32') {
    const userProfile = process.env.USERPROFILE || home;
    candidates.push(
      path.join(userProfile, 'Music'),
      path.join(userProfile, 'Videos'),
      path.join(userProfile, 'Downloads'),
      path.join(userProfile, 'Desktop'),
    );
  } else {
    // Linux
    candidates.push(
      path.join(home, 'Music'),
      path.join(home, 'Videos'),
      path.join(home, 'Downloads'),
      path.join(home, 'Desktop'),
    );
    // Respect XDG user dirs
    const xdgMusic = process.env.XDG_MUSIC_DIR;
    const xdgVideos = process.env.XDG_VIDEOS_DIR;
    if (xdgMusic) candidates.push(xdgMusic);
    if (xdgVideos) candidates.push(xdgVideos);
    // External drives
    if (fs.existsSync('/media')) candidates.push('/media');
    if (fs.existsSync('/mnt')) candidates.push('/mnt');
  }

  return candidates.filter((dir) => {
    try {
      return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  });
}
