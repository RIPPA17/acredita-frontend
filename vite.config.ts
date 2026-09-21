import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const buildCommit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local';

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'acredita-build-metadata',
        transformIndexHtml(html: string) {
          return html.replace(
            '</head>',
            `    <meta name="acredita-build" content="${buildCommit}">\n  </head>`,
          );
        },
      },
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
