import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { initPlatform, PlatformProvider } from './platform';
import { usePlayerStore } from './store/usePlayerStore';

// Service workers are a web-only concept. Registering one inside the Tauri or
// Capacitor WebView can interfere with how those shells load and cache local
// assets (e.g. stale bundles surviving across app updates), so we only ever
// register it in a real browser tab.
function isNativeShell(): boolean {
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window || 'Capacitor' in window;
}

if ('serviceWorker' in navigator && !isNativeShell()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

async function bootstrap() {
  try {
    const capabilities = await initPlatform();
    usePlayerStore.getState().init();

    createRoot(document.getElementById('root')!).render(
      <PlatformProvider value={capabilities}>
        <App />
      </PlatformProvider>,
    );
  } catch (err) {
    // Last-resort error display — ensures the window is never silently blank.
    // In production this should ideally be a styled error screen, but even a
    // plain text message is infinitely better than a black void.
    console.error('[Zovyra] Bootstrap failed:', err);
    const root = document.getElementById('root');
    if (root) {
      root.style.cssText =
        'display:flex;align-items:center;justify-content:center;height:100vh;' +
        'background:#0f172a;color:#f8fafc;font-family:Inter,sans-serif;flex-direction:column;gap:12px;';
      root.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style="font-size:1.1rem;font-weight:600;margin:0">Zovyra failed to start</p>
        <p style="font-size:0.8rem;color:#94a3b8;margin:0;max-width:360px;text-align:center">
          ${err instanceof Error ? err.message : String(err)}
        </p>
        <button onclick="location.reload()"
          style="margin-top:8px;padding:8px 20px;background:#6d28d9;color:#fff;border:none;
                 border-radius:8px;cursor:pointer;font-size:0.85rem">
          Reload
        </button>`;
    }
  }
}

bootstrap();
