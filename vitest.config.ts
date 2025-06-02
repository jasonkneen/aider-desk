/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; 
import path from 'path'; // Needed for path.resolve

// Using a dynamic import for vite-tsconfig-paths is good practice
export default defineConfig(async () => {
  const tsconfigPaths = (await import('vite-tsconfig-paths')).default;
  
  return {
    plugins: [
      react(), 
      tsconfigPaths(),
    ],
    test: {
      globals: true, 
      environment: 'jsdom', 
      setupFiles: ['./src/setupTests.ts'], 
      // include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], // Default is usually fine
      alias: [ // For main process tests to mock electron
        {
          find: /^electron$/, // Match 'electron' exactly
          replacement: path.resolve(__dirname, './test/mocks/electron-mock.ts'),
        },
      ],
    },
  };
});
