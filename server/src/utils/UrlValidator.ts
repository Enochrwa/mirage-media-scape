import { URL } from 'url';
import net from 'net';

export class UrlValidator {
  public static validate(urlStr: string): string {
    const url = new URL(urlStr);

    // Whitelist protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }

    const hostname = url.hostname;

    // Disallow loopback and private IP ranges to mitigate SSRF
    if (this.isPrivateIP(hostname)) {
      throw new Error('Access to private network addresses is prohibited');
    }

    return url.toString();
  }

  private static isPrivateIP(hostname: string): boolean {
    // Basic hostname checks
    if (hostname === 'localhost' || hostname.endsWith('.local')) {
      return true;
    }

    if (net.isIP(hostname)) {
      const ip = hostname;

      // IPv4 private ranges
      // 127.0.0.0/8 (Loopback)
      // 10.0.0.0/8 (Private)
      // 172.16.0.0/12 (Private)
      // 192.168.0.0/16 (Private)
      // 169.254.0.0/16 (Link-local)

      const parts = ip.split('.').map(Number);
      if (parts[0] === 127 || parts[0] === 10) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;

      // IPv6 loopback
      if (ip === '::1') return true;
    }

    return false;
  }
}
