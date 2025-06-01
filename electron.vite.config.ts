import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import prism from 'vite-plugin-prismjs';

const ReactCompilerConfig = {
  target: '18',
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), tsconfigPaths()],
  },
  preload: {
    plugins: [externalizeDepsPlugin(), tsconfigPaths()],
  },
  renderer: {
    plugins: [
      prism({
        languages: 'all',
        theme: 'tomorrow',
        css: true,
      }),
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler', ReactCompilerConfig]],
        },
      }),
      tsconfigPaths(),
    ],
    server: {
      hmr: process.env.NO_HMR === 'true' ? false : undefined,
    },
  },
});
