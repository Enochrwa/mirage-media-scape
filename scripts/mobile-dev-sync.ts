#!/usr/bin/env tsx
/**
 * scripts/mobile-dev-sync.ts
 *
 * Prepares the mobile app for live-reload dev testing on a real device:
 *   1. Detects this machine's LAN IP.
 *   2. Builds the frontend with VITE_API_BASE_URL pointed at that IP (so the
 *      app on your phone can reach the Node/Express server over Wi-Fi).
 *   3. Runs `npx cap sync` with ZOVYRA_DEV_SERVER_URL set, so capacitor.config.ts
 *      points the native shell at the live Vite dev server instead of bundling
 *      a static build — giving you hot reload on-device.
 *
 * Run this once before `npx cap run android` / `npx cap run ios`, and re-run it
 * whenever your machine's LAN IP changes (e.g. switching Wi-Fi networks).
 *
 * Prerequisites:
 *   - Phone and dev machine on the same Wi-Fi network.
 *   - `npm run dev:server` running in another terminal (port 3001).
 *   - `npm run dev:frontend` running in another terminal (port 8080) — cap run
 *     will load this live server on-device instead of a static bundle.
 */

import { execSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const FRONTEND = join(ROOT, 'frontend');

function findLanIp(): string {
  const interfaces = networkInterfaces();
  const preferredOrder = ['en0', 'en1', 'Wi-Fi', 'Wireless LAN adapter Wi-Fi', 'eth0', 'wlan0'];
  const candidates: { name: string; address: string }[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        candidates.push({ name, address: addr.address });
      }
    }
  }

  if (candidates.length === 0) {
    console.error('[mobile-dev-sync] No LAN IP found. Connect to Wi-Fi and retry.');
    process.exit(1);
  }

  for (const preferred of preferredOrder) {
    const match = candidates.find((c) => c.name === preferred);
    if (match) return match.address;
  }
  return candidates[0].address;
}

const ip = findLanIp();
console.log(`\n📱 Mobile dev sync — LAN IP detected: ${ip}`);
console.log('   Make sure your phone is on the same Wi-Fi network.\n');

const apiUrl = `http://${ip}:3001`;
const devServerUrl = `http://${ip}:8080`;

console.log(`→ API base URL:    ${apiUrl}`);
console.log(`→ Dev server URL:  ${devServerUrl}\n`);

console.log('Syncing native projects (npx cap sync)…\n');
execSync('npx cap sync', {
  cwd: FRONTEND,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_API_BASE_URL: apiUrl,
    ZOVYRA_DEV_SERVER_URL: devServerUrl,
  },
});

console.log('\n✔ Synced. Now run, in separate terminals:');
console.log('   npm run dev:server     (from repo root)');
console.log('   npm run dev:frontend   (from repo root)');
console.log('And then, from frontend/:');
console.log('   npx cap run android    (or: npx cap run ios)');
