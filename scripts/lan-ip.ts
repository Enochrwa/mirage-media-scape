#!/usr/bin/env tsx
/**
 * scripts/lan-ip.ts
 *
 * Prints the machine's LAN IPv4 address — the address a phone on the same
 * Wi-Fi network can use to reach this machine's dev server.
 *
 * Used by `npm run dev:mobile` to auto-populate VITE_API_BASE_URL and
 * ZOVYRA_DEV_SERVER_URL so you don't have to hardcode an IP that changes
 * every time you join a different network.
 *
 * Usage:
 *   npx tsx scripts/lan-ip.ts          → prints the IP, e.g. 192.168.1.50
 *   npx tsx scripts/lan-ip.ts --quiet  → same, no extra log lines (for $(...) capture)
 */

import { networkInterfaces } from 'node:os';

function findLanIp(): string | null {
  const interfaces = networkInterfaces();

  // Prefer common physical-adapter names across platforms; fall back to "any
  // non-loopback IPv4" if nothing matches (covers Wi-Fi, Ethernet, Linux, WSL).
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

  if (candidates.length === 0) return null;

  for (const preferred of preferredOrder) {
    const match = candidates.find((c) => c.name === preferred);
    if (match) return match.address;
  }

  // No exact name match — just take the first non-loopback IPv4 found.
  return candidates[0].address;
}

const quiet = process.argv.includes('--quiet');
const ip = findLanIp();

if (!ip) {
  if (!quiet) {
    console.error('[lan-ip] Could not detect a LAN IP. Are you connected to Wi-Fi/Ethernet?');
    console.error('[lan-ip] Falling back to localhost — this will NOT work from a phone.');
  }
  console.log('localhost');
  process.exit(0);
}

if (!quiet) {
  console.error(`[lan-ip] Detected LAN IP: ${ip}`);
  console.error('[lan-ip] Make sure your phone is on the same Wi-Fi network.');
}
console.log(ip);
