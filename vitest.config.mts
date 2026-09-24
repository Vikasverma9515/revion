import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '#': fileURLToPath(new URL('.', import.meta.url)),
      // 'server-only' throws outside a React server build; it is a no-op in tests.
      'server-only': fileURLToPath(new URL('./tests/stubs/empty.ts', import.meta.url)),
    },
  },
  // Tests never render CSS; skip the app's Tailwind PostCSS pipeline.
  css: { postcss: { plugins: [] } },
  test: { include: ['tests/**/*.test.ts'] },
});
