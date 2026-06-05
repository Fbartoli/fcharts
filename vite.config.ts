import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const here = import.meta.dirname;
const coreEntry = resolve(here, 'src/fchart.ts');

// `vite` (serve)                       → serves the benchmark page (bench/ is the only HTML root).
// `vite build`                         → core library: dist/fcharts.js (ESM) + .umd.cjs.
// `SIGHTLINE_ENTRY=react vite build`   → the React adapter: dist/react.js (ESM; react + core external).
// `SIGHTLINE_ENTRY=compliance vite build` → the Compliance Pack: dist/compliance/{index,cli}.js (Node ESM).
export default defineConfig(({ command }) => {
  if (command === 'serve') {
    // Default dev root is the benchmark; `SIGHTLINE_ROOT=landing vite` serves the site.
    const sub = process.env.SIGHTLINE_ROOT ?? 'bench';
    return {
      root: resolve(here, sub),
      // Per-root dep cache so the bench and landing dev servers can run at once without
      // clobbering each other's optimized deps (a shared node_modules/.vite races -> 504s).
      cacheDir: resolve(here, 'node_modules', `.vite-${sub}`),
      // Serve the committed sample ACR(s) on the landing origin (single source, no duplication),
      // so the marketing page can link to the real generated VPAT/ACR at /acr-en301549.html.
      publicDir: sub === 'landing' ? resolve(here, 'compliance/samples') : false,
      server: { port: 5180 },
    };
  }
  if (process.env.SIGHTLINE_ENTRY === 'site') {
    // Static marketing site build (landing + playground + the sample ACR), deployed to Cloudflare
    // Pages alongside functions/. Not a lib build — this is a real multi-page app build.
    return {
      root: resolve(here, 'landing'),
      publicDir: resolve(here, 'compliance/samples'), // ships /acr-en301549.html with the site
      build: {
        outDir: resolve(here, 'dist-site'),
        emptyOutDir: true,
        rollupOptions: {
          input: {
            main: resolve(here, 'landing/index.html'),
            playground: resolve(here, 'landing/playground.html'),
          },
        },
      },
    };
  }
  if (process.env.SIGHTLINE_ENTRY === 'react') {
    // Second build pass (after the core): keep React AND the core out of the bundle so a consumer
    // who imports both `sightline` and `fcharts-js/react` ships one copy of the engine, not two.
    // emptyOutDir:false so we don't wipe the core build that ran first.
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
        rollupOptions: {
          external: ['react', 'react/jsx-runtime', coreEntry],
          // Rewrite the externalized core import to the sibling built file consumers receive.
          output: { paths: { [coreEntry]: './fcharts.js' } },
        },
      },
    };
  }
  if (process.env.SIGHTLINE_ENTRY === 'compliance') {
    // Third build pass: the Compliance Pack as Node ESM. Node refuses to strip types under
    // node_modules, so the bin + the `fcharts-js/compliance` subpath must ship compiled JS, not the
    // raw .ts source. Playwright/Vite/Node builtins stay external (optional peers at the consumer).
    return {
      build: {
        outDir: resolve(here, 'dist/compliance'),
        emptyOutDir: false,
        sourcemap: true,
        minify: false, // a CLI + library; keep it readable and avoid mangling the shebang
        lib: {
          entry: {
            index: resolve(here, 'src/compliance/index.ts'),
            cli: resolve(here, 'src/compliance/cli.ts'),
          },
          formats: ['es'],
        },
        rollupOptions: {
          external: [/^node:/, 'playwright', 'vite'],
          // The CLI entry keeps its source `#!/usr/bin/env node` shebang through the build.
          output: { entryFileNames: '[name].js' },
        },
      },
    };
  }
  return {
    build: {
      outDir: resolve(here, 'dist'),
      sourcemap: true,
      minify: 'esbuild',
      lib: {
        entry: coreEntry,
        name: 'fcharts',
        fileName: 'fcharts',
        // ESM for bundlers; UMD so prospects can drop a <script> tag with zero build.
        formats: ['es', 'umd'],
      },
    },
  };
});
