// Rewrite .ts → .js in relative import/export specifiers of emitted .d.ts files.
// We use explicit .ts extensions in source (required to run tests on node:test), but
// consumers need the published declarations to reference .js (which resolves to the
// sibling .d.ts). tsc's rewriteRelativeImportExtensions doesn't cover declaration
// re-exports here, so we do it ourselves — no dependency.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const RELATIVE_TS = /(["']\.{1,2}\/[^"']*?)\.ts(["'])/g;
let changed = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.d.ts')) {
      const src = readFileSync(p, 'utf8');
      const out = src.replace(RELATIVE_TS, '$1.js$2');
      if (out !== src) {
        writeFileSync(p, out);
        changed++;
      }
    }
  }
}

walk(dist);
console.log(`fix-dts: rewrote .ts→.js specifiers in ${changed} declaration file(s)`);
