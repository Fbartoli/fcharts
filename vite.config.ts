import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const here = import.meta.dirname;

// `vite` (serve) → serves the benchmark page (bench/ is the only HTML root).
// `vite build`   → library mode: emits dist/sightline.js (ESM) + dist/sightline.css.
export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: resolve(here, 'bench'),
      server: { port: 5180 },
    };
  }
  return {
    build: {
      outDir: resolve(here, 'dist'),
      sourcemap: true,
      minify: 'esbuild',
      lib: {
        entry: resolve(here, 'src/index.ts'),
        name: 'Sightline',
        fileName: 'sightline',
        formats: ['es'],
      },
    },
  };
});
