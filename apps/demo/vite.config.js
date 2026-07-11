import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => ({
  plugins: [
    react({
      // TweakLocal stamping is dev-only: production builds skip Babel entirely.
      babel:
        command === 'serve'
          ? { plugins: [['@tweaklocal/babel-plugin', { root: process.cwd() }]] }
          : undefined,
    }),
    tailwindcss(),
    {
      name: 'tweaklocal-overlay-inject',
      apply: 'serve',
      transformIndexHtml(html) {
        return {
          html,
          tags: [
            {
              tag: 'script',
              attrs: { src: 'http://localhost:4100/overlay.js', defer: true },
              injectTo: 'body',
            },
          ],
        };
      },
    },
  ],
}));
