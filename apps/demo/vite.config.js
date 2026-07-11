import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['@fastui/babel-plugin', { root: process.cwd() }]],
      },
    }),
    tailwindcss(),
    {
      name: 'fastui-overlay-inject',
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
});
