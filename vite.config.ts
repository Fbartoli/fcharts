import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const here = import.meta.dirname;

// `vite` (serve)                  → serves the benchmark page (bench/ is the only HTML root).
// `vite build`                    → core library: dist/sightline.js (ESM) + .umd.cjs.
// `SIGHTLINE_ENTRY=react vite build` → the React adapter: dist/react.js (ESM, react external).
export default defineConfig(({ command }) => {
  if (command === 'serve') {
    // Default dev root is the benchmark; `SIGHTLINE_ROOT=landing vite` serves the site.
    const sub = process.env.SIGHTLINE_ROOT ?? 'bench';
    return {
      root: resolve(here, sub),
      server: { port: 5180 },
    };
  }
  if (process.env.SIGHTLINE_ENTRY === 'react') {
    // Second build pass (after the core): keep React out of the bundle so consumers use their
    // own copy. emptyOutDir:false so we don't wipe the core build that ran first.
    return {
      build: {
        outDir: resolve(here, 'dist'),
        emptyOutDir: false,
        sourcemap: true,
        minify: 'esbuild',
        lib: {
          entry: resolve(here, 'src/react.ts'),
          fileName: () => 'react.js',
          formats: ['es'],
        },
        rollupOptions: { external: ['react', 'react/jsx-runtime'] },
      },
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
        // ESM for bundlers; UMD so prospects can drop a <script> tag with zero build.
        formats: ['es', 'umd'],
      },
    },
  };
});
