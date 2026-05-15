import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { initPlatform } from './platform';
import { PlatformProvider } from './platform/PlatformContext';

async function bootstrap() {
  const capabilities = await initPlatform();

  createRoot(document.getElementById('root')!).render(
    <PlatformProvider value={capabilities}>
      <App />
    </PlatformProvider>
  );
}

bootstrap();
