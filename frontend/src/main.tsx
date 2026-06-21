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
  const capabilities = await initPlatform();
  usePlayerStore.getState().init();

  createRoot(document.getElementById('root')!).render(
    <PlatformProvider value={capabilities}>
      <App />
    </PlatformProvider>,
  );
}

bootstrap();
