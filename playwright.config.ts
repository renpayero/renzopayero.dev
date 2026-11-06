import { defineConfig, devices } from '@playwright/test';

// Astro permite una sola instancia de preview: TEST_PORT reutiliza la que ya está corriendo (hay que compilar antes).
const PORT = Number(process.env.TEST_PORT ?? 4322);
// TEST_BASE_URL apunta las pruebas a un sitio ya publicado: no compila ni levanta nada.
const REMOTE = process.env.TEST_BASE_URL;

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: REMOTE ?? `http://127.0.0.1:${PORT}`,
    trace: 'off',
  },
  projects: [
    { name: 'chromium-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'chromium-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'chromium-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'firefox-1440', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit-1440', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit-390', use: { ...devices['Desktop Safari'], viewport: { width: 390, height: 844 } } },
  ],
  ...(REMOTE
    ? {}
    : {
        webServer: {
          command: `npm run build && npm run preview -- --port ${PORT} --host 127.0.0.1`,
          url: `http://127.0.0.1:${PORT}`,
          timeout: 120_000,
          reuseExistingServer: Boolean(process.env.TEST_PORT),
        },
      }),
});
