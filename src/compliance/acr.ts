/**
 * ACR generator (vpat-editions.md §5) — builds the `AcrModel` from the baseline + edition, and
 * renders it to Markdown, HTML, or JSON. Pure string templating, zero dependencies. The pure
 * generator never reads the clock — the caller injects `generatedAt`.
 */
import type {
  AcrModel,
  Conformance,
  ConformanceTally,
  CriterionRow,
  EditionKey,
  EvaluationInfo,
  ProductInfo,
  ReportSection,
} from './types.ts';
import { EDITIONS, buildSections } from './editions.ts';

export const LEGAL =
  'This Accessibility Conformance Report is provided for informational purposes and reflects an ' +
  'evaluation of the named version. "VPAT" is a registered service mark of the Information ' +
  'Technology Industry Council (ITI). Conformance is scoped to the chart component only (see ' +
  'Component Scope); the embedding application and page remain responsible for page-level ' +
  'criteria. This document is not legal advice.';

const CONFORMANCE_TERMS: [Conformance, string][] = [
  ['Supports', 'The functionality meets the criterion without known defects (for the documented usage).'],
  ['Partially Supports', 'Some functionality meets the criterion; a named gap remains.'],
  ['Does Not Support', 'The majority of functionality does not meet the criterion.'],
  ['Not Applicable', 'The criterion does not apply to this chart component.'],
  ['Not Evaluated', 'Not evaluated (out of the automatable component scope).'],
];

const PRINCIPLES: [string, string][] = [
  ['1', 'Perceivable'],
  ['2', 'Operable'],
  ['3', 'Understandable'],
  ['4', 'Robust'],
];

/** Count WCAG (non-adaptation) rows per conformance level. */
export function tally(rows: readonly CriterionRow[]): ConformanceTally {
  const byLevel: ConformanceTally['byLevel'] = { A: {}, AA: {} };
  const total: ConformanceTally['total'] = {};
  for (const r of rows) {
    byLevel[r.level][r.conformance] = (byLevel[r.level][r.conformance] ?? 0) + 1;
    total[r.conformance] = (total[r.conformance] ?? 0) + 1;
  }
  return { byLevel, total };
}

export interface BuildModelInput {
  criteria: readonly CriterionRow[];
  edition: EditionKey;
  product: ProductInfo;
  evaluation: EvaluationInfo;
  /** ISO timestamp, injected by the caller. */
  generatedAt: string;
  signed?: { signer: string; date: string };
}

/** Assemble a complete, renderable ACR model for one edition. */
export function buildModel(input: BuildModelInput): AcrModel {
  const wcag = input.criteria.filter((c) => !c.adaptation);
  return {
    product: input.product,
    edition: EDITIONS[input.edition],
    evaluation: input.evaluation,
    criteria: [...input.criteria],
    sections: buildSections(input.criteria, input.edition),
    summary: tally(wcag),
    legal: LEGAL,
    generatedAt: input.generatedAt,
    signed: input.signed,
  };
}

// --- shared helpers ---

const wcagRows = (m: AcrModel): CriterionRow[] => m.criteria.filter((c) => !c.adaptation);
const adaptationRows = (m: AcrModel): CriterionRow[] => m.criteria.filter((c) => c.adaptation);
const attestationRows = (m: AcrModel): CriterionRow[] =>
  m.criteria.filter((c) => c.attestationRequired && c.applicability === 'applicable');
const isDraft = (m: AcrModel): boolean => !m.signed && attestationRows(m).length > 0;

function summaryLine(m: AcrModel): string {
  const t = m.summary.total;
  const part = (c: Conformance): string => `${t[c] ?? 0} ${c}`;
  return `${part('Supports')} · ${part('Partially Supports')} · ${part('Not Applicable')}` +
    (t['Does Not Support'] ? ` · ${part('Does Not Support')}` : '');
}

// --- Markdown ---

function esc(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function mdTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map(esc).join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}`;
}

function renderMarkdown(m: AcrModel): string {
  const out: string[] = [];
  out.push(`# Accessibility Conformance Report — ${m.product.name} ${m.product.version}`);
  out.push(`\n**${m.edition.title}**`);
  if (isDraft(m)) {
    out.push(
      `\n> ⚠️ **DRAFT — not signed.** ${attestationRows(m).length} criteria require human ` +
        `attestation (see *Attestation* below) before this report is final.`,
    );
  } else if (m.signed) {
    out.push(`\n> ✅ **Signed** by ${m.signed.signer} on ${m.signed.date}.`);
  }

  out.push('\n## Product & evaluation');
  out.push(
    mdTable(
      ['Field', 'Value'],
      [
        ['Product', m.product.name],
        ['Version', m.product.version],
        ['Description', m.product.description],
        ['Report date', m.generatedAt],
        ['Standards', m.edition.standards.join(' ')],
        ['URL', m.product.url ?? '—'],
        ['Evaluation methods', m.evaluation.methods.join('; ')],
        ['Component scope', m.product.componentScope],
      ],
    ),
  );
  if (m.evaluation.notes) out.push(`\n${m.evaluation.notes}`);

  out.push('\n## Conformance terms');
  out.push(CONFORMANCE_TERMS.map(([t, d]) => `- **${t}** — ${d}`).join('\n'));

  out.push('\n## Summary');
  out.push(`**${summaryLine(m)}** across ${wcagRows(m).length} WCAG 2.2 A/AA success criteria.`);
  out.push(
    mdTable(
      ['Level', 'Supports', 'Partially Supports', 'Does Not Support', 'Not Applicable'],
      (['A', 'AA'] as const).map((lvl) => {
        const b = m.summary.byLevel[lvl];
        return [
          `Level ${lvl}`,
          String(b['Supports'] ?? 0),
          String(b['Partially Supports'] ?? 0),
          String(b['Does Not Support'] ?? 0),
          String(b['Not Applicable'] ?? 0),
        ];
      }),
    ),
  );

  for (const [digit, name] of PRINCIPLES) {
    const rows = wcagRows(m).filter((c) => c.num.startsWith(`${digit}.`));
    if (!rows.length) continue;
    out.push(`\n## ${name}`);
    out.push(
      mdTable(
        ['Criteria', 'Level', 'Conformance Level', 'Remarks and Explanations'],
        rows.map((c) => [`${c.num} ${c.name}`, c.level, c.conformance, c.remarks]),
      ),
    );
  }

  const adapt = adaptationRows(m);
  if (adapt.length) {
    out.push('\n## Additional adaptations (beyond Level A/AA)');
    out.push(
      mdTable(
        ['Feature', 'Conformance Level', 'Remarks and Explanations'],
        adapt.map((c) => [c.name, c.conformance, c.remarks]),
      ),
    );
  }

  for (const s of m.sections) out.push(renderSectionMd(s));

  out.push('\n## Attestation');
  const att = attestationRows(m);
  if (m.signed) {
    out.push(`Signed by **${m.signed.signer}** on **${m.signed.date}**.`);
  } else if (att.length) {
    out.push(
      'The following criteria rest on human attestation (perceptual judgment, real assistive-' +
        'technology behavior, or integration context) and must be confirmed and signed before this ' +
        'report is final:',
    );
    out.push(att.map((c) => `- **${c.num} ${c.name}** — ${c.verification}`).join('\n'));
  } else {
    out.push('No criteria require manual attestation.');
  }

  out.push(`\n## Legal\n${m.legal}`);
  out.push(`\n_Generated ${m.generatedAt}._`);
  return out.join('\n');
}

function renderSectionMd(s: ReportSection): string {
  const intro = s.intro ? `\n${s.intro}` : '';
  return (
    `\n## ${s.title}${intro}\n` +
    mdTable(
      ['Clause', 'Criteria', 'Conformance Level', 'Remarks and Explanations'],
      s.rows.map((r) => [r.id, r.name, r.conformance, r.remarks]),
    )
  );
}

// --- HTML ---

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlTable(headers: string[], rows: string[][]): string {
  const th = headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

const HTML_CSS =
  'body{font:16px/1.5 system-ui,-apple-system,sans-serif;color:#1f2937;max-width:60rem;' +
  'margin:2rem auto;padding:0 1rem}h1{font-size:1.6rem}h2{font-size:1.2rem;margin-top:2rem;' +
  'border-bottom:1px solid #e5e7eb;padding-bottom:.25rem}table{border-collapse:collapse;width:100%;' +
  'margin:.5rem 0;font-size:.92rem}th,td{border:1px solid #d1d5db;padding:.4rem .55rem;text-align:left;' +
  'vertical-align:top}th{background:#f3f4f6}.draft{background:#fef3c7;border:1px solid #f59e0b;' +
  'padding:.6rem .8rem;border-radius:6px}.signed{background:#dcfce7;border:1px solid #16a34a;' +
  'padding:.6rem .8rem;border-radius:6px}code{background:#f3f4f6;padding:.1rem .3rem;border-radius:3px}';

function renderHtml(m: AcrModel): string {
  const parts: string[] = [];
  parts.push(`<h1>Accessibility Conformance Report — ${escapeHtml(m.product.name)} ${escapeHtml(m.product.version)}</h1>`);
  parts.push(`<p><strong>${escapeHtml(m.edition.title)}</strong></p>`);
  if (isDraft(m)) {
    parts.push(
      `<p class="draft">⚠️ <strong>DRAFT — not signed.</strong> ${attestationRows(m).length} ` +
        `criteria require human attestation before this report is final.</p>`,
    );
  } else if (m.signed) {
    parts.push(`<p class="signed">✅ <strong>Signed</strong> by ${escapeHtml(m.signed.signer)} on ${escapeHtml(m.signed.date)}.</p>`);
  }

  parts.push('<h2>Product &amp; evaluation</h2>');
  parts.push(
    htmlTable(
      ['Field', 'Value'],
      [
        ['Product', m.product.name],
        ['Version', m.product.version],
        ['Description', m.product.description],
        ['Report date', m.generatedAt],
        ['Standards', m.edition.standards.join(' ')],
        ['URL', m.product.url ?? '—'],
        ['Evaluation methods', m.evaluation.methods.join('; ')],
        ['Component scope', m.product.componentScope],
      ],
    ),
  );
  if (m.evaluation.notes) parts.push(`<p>${escapeHtml(m.evaluation.notes)}</p>`);

  parts.push('<h2>Conformance terms</h2><ul>');
  for (const [t, d] of CONFORMANCE_TERMS) parts.push(`<li><strong>${t}</strong> — ${escapeHtml(d)}</li>`);
  parts.push('</ul>');

  parts.push('<h2>Summary</h2>');
  parts.push(`<p><strong>${escapeHtml(summaryLine(m))}</strong> across ${wcagRows(m).length} WCAG 2.2 A/AA success criteria.</p>`);
  parts.push(
    htmlTable(
      ['Level', 'Supports', 'Partially Supports', 'Does Not Support', 'Not Applicable'],
      (['A', 'AA'] as const).map((lvl) => {
        const b = m.summary.byLevel[lvl];
        return [
          `Level ${lvl}`,
          String(b['Supports'] ?? 0),
          String(b['Partially Supports'] ?? 0),
          String(b['Does Not Support'] ?? 0),
          String(b['Not Applicable'] ?? 0),
        ];
      }),
    ),
  );

  for (const [digit, name] of PRINCIPLES) {
    const rows = wcagRows(m).filter((c) => c.num.startsWith(`${digit}.`));
    if (!rows.length) continue;
    parts.push(`<h2>${name}</h2>`);
    parts.push(
      htmlTable(
        ['Criteria', 'Level', 'Conformance Level', 'Remarks and Explanations'],
        rows.map((c) => [`${c.num} ${c.name}`, c.level, c.conformance, c.remarks]),
      ),
    );
  }

  const adapt = adaptationRows(m);
  if (adapt.length) {
    parts.push('<h2>Additional adaptations (beyond Level A/AA)</h2>');
    parts.push(
      htmlTable(
        ['Feature', 'Conformance Level', 'Remarks and Explanations'],
        adapt.map((c) => [c.name, c.conformance, c.remarks]),
      ),
    );
  }

  for (const s of m.sections) {
    parts.push(`<h2>${escapeHtml(s.title)}</h2>`);
    if (s.intro) parts.push(`<p>${escapeHtml(s.intro)}</p>`);
    parts.push(
      htmlTable(
        ['Clause', 'Criteria', 'Conformance Level', 'Remarks and Explanations'],
        s.rows.map((r) => [r.id, r.name, r.conformance, r.remarks]),
      ),
    );
  }

  parts.push('<h2>Attestation</h2>');
  const att = attestationRows(m);
  if (m.signed) parts.push(`<p>Signed by <strong>${escapeHtml(m.signed.signer)}</strong> on <strong>${escapeHtml(m.signed.date)}</strong>.</p>`);
  else if (att.length) {
    parts.push('<p>The following criteria rest on human attestation and must be confirmed and signed before this report is final:</p><ul>');
    for (const c of att) parts.push(`<li><strong>${c.num} ${escapeHtml(c.name)}</strong> — ${c.verification}</li>`);
    parts.push('</ul>');
  } else parts.push('<p>No criteria require manual attestation.</p>');

  parts.push(`<h2>Legal</h2><p>${escapeHtml(m.legal)}</p>`);
  parts.push(`<p><em>Generated ${escapeHtml(m.generatedAt)}.</em></p>`);
  // Embed the model so the HTML is itself machine-readable (fcharts' agent-readable ethos).
  parts.push(`<script type="application/json" data-acr>${JSON.stringify(m).replace(/</g, '\\u003c')}</script>`);

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>ACR — ${escapeHtml(m.product.name)} ${escapeHtml(m.product.version)} (${escapeHtml(m.edition.title)})</title>` +
    `<style>${HTML_CSS}</style></head><body>${parts.join('')}</body></html>`
  );
}

export type AcrFormat = 'md' | 'html' | 'json';

/** Render a built model to one of the three formats. */
export function renderAcr(model: AcrModel, format: AcrFormat): string {
  if (format === 'json') return JSON.stringify(model, null, 2);
  if (format === 'html') return renderHtml(model);
  return renderMarkdown(model);
}
