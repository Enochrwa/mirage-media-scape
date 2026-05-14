import { URL } from 'url';
import net from 'net';

export class UrlValidator {
  public static validate(urlStr: string): string {
    const url = new URL(urlStr);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }

    if (this.isPrivate(url.hostname)) {
      throw new Error('Access to private network addresses is prohibited');
    }

    return url.toString();
  }

  public static isPrivate(hostname: string): boolean {
    const h = hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h === '0.0.0.0') {
      return true;
    }

    const ipType = net.isIP(h);
    if (ipType === 4) {
      const parts = h.split('.').map(Number);
      if (parts[0] === 127 || parts[0] === 10) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
    } else if (ipType === 6) {
      if (h === '::1' || h === '::') return true;
      if (h.startsWith('fe80:')) return true;
      if (h.startsWith('fc00:') || h.startsWith('fd00:')) return true;
    }

    return false;
  }
}