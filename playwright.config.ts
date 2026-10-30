import { defineConfig } from '@playwright/test';

// Usa el Edge instalado en el equipo: no descarga navegadores.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  reporter: 'list',
  workers: 1,
  use: { channel: 'msedge', headless: true, viewport: { width: 1280, height: 900 }, acceptDownloads: true },
});
