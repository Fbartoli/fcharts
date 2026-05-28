// Reports the minified + gzipped size of the built core bundle.
// Uses only Node built-ins (no gzip-size dependency).
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const LIMIT_KB = 30;

let jsFiles;
try {
  jsFiles = readdirSync(dist).filter((f) => f.endsWith('.js'));
} catch {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

let rawTotal = 0;
let gzTotal = 0;
for (const f of jsFiles) {
  const buf = readFileSync(resolve(dist, f));
  const gz = gzipSync(buf, { level: 9 });
  rawTotal += statSync(resolve(dist, f)).size;
  gzTotal += gz.length;
  console.log(`  ${f.padEnd(20)} ${(buf.length / 1024).toFixed(1)} KB raw  ${(gz.length / 1024).toFixed(2)} KB gzip`);
}

const gzKb = gzTotal / 1024;
console.log(`\n  total: ${(rawTotal / 1024).toFixed(1)} KB raw  ${gzKb.toFixed(2)} KB min+gzip`);
console.log(`  budget: ${LIMIT_KB} KB`);

if (gzKb > LIMIT_KB) {
  console.error(`\n  ✗ over budget by ${(gzKb - LIMIT_KB).toFixed(2)} KB`);
  process.exit(1);
}
console.log(`\n  ✓ under ${LIMIT_KB} KB budget (${(LIMIT_KB - gzKb).toFixed(2)} KB headroom)`);
