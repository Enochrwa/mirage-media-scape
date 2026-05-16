import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { initPlatform, PlatformProvider } from './platform';
import { usePlayerStore } from './store/usePlayerStore';

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
