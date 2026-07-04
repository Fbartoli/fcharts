/// <reference types="vite/client" />
/**
 * Examples gallery — the fastchart-style "source above every render" pattern, with a
 * drift-proof twist: the examples module is imported twice, once executed and once as raw
 * text (`?raw`), and the displayed snippet is sliced from the raw source by markers. What
 * you read is byte-for-byte what ran — minification can't garble it.
 */
import { EXAMPLES } from './gallery-examples.ts';
import rawSource from './gallery-examples.ts?raw';

/** Slice a marked snippet out of the raw module text and dedent it for display. */
function sourceOf(snip: string): string {
  const start = rawSource.indexOf(`// snip:${snip}\n`);
  const end = rawSource.indexOf('// endsnip', start);
  if (start === -1 || end === -1) return '(source unavailable)';
  const body = rawSource.slice(rawSource.indexOf('\n', start) + 1, end);
  const lines = body.replace(/\s+$/, '').split('\n');
  const indents = lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length);
  const indent = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(indent)).join('\n');
}

const root = document.getElementById('gallery')!;
for (const ex of EXAMPLES) {
  const section = document.createElement('section');
  const h2 = document.createElement('h2');
  h2.textContent = ex.title;
  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = ex.note;
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = sourceOf(ex.snip);
  pre.append(code);
  const host = document.createElement('div');
  host.className = 'output';
  section.append(h2, note, pre, host);
  root.append(section);
  ex.run(host);
}
