import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Dev server (npm run dev) serves every page by path automatically.
// Production build is per-entry — see build.mjs — so each tool inlines
// into its own self-contained HTML file.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
});
