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
    if (fs.existsSync('/media')) {
      const user = os.userInfo().username;
      const userMedia = path.join('/media', user);
      if (fs.existsSync(userMedia)) {
        candidates.push(userMedia);
      }
      // Don't add raw /media — it contains device nodes and other users
    }
    if (fs.existsSync('/mnt')) {
      // Only add real subdirectory mounts (skip symlinks, device nodes)
      try {
        const entries = fs.readdirSync('/mnt', { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            const full = path.join('/mnt', e.name);
            try {
              fs.accessSync(full, fs.constants.R_OK);
              candidates.push(full);
            } catch { /* skip inaccessible */ }
          }
        }
      } catch { /* /mnt not listable */ }
    }
  }

  return candidates.filter((dir) => {
    try {
      return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  });
}
