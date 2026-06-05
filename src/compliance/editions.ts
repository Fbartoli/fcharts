/**
 * VPAT editions + edition-specific sections (vpat-editions.md §2–§3).
 *
 * The WCAG core (criteria.ts) is shared by all editions; this module adds the edition framing
 * (EN 301 549 / WCAG / Section 508) and the functional-performance, software, and documentation
 * tables — all **derived** from the WCAG rows so they can never contradict the per-SC claims.
 * Pure; no DOM/Playwright.
 */
import type {
  Conformance,
  CriterionRow,
  EditionInfo,
  EditionKey,
  ReportSection,
  SectionRow,
} from './types.ts';

export const EDITIONS: Record<EditionKey, EditionInfo> = {
  en301549: {
    key: 'en301549',
    title: 'VPAT® 2.5 EU — EN 301 549',
    standards: [
      'EN 301 549 (the EAA harmonized standard); Chapter 9 references WCAG 2.1 Level A/AA.',
      'This report maps WCAG 2.2 Level A + AA — a superset of 2.1 — so the EN 301 549 web ' +
        'requirements are fully covered, with the 6 newer 2.2 criteria as additional assurance.',
    ],
    wcagVersion: '2.2',
    wcagSubset: 'A+AA',
  },
  wcag: {
    key: 'wcag',
    title: 'VPAT® 2.5 — WCAG',
    standards: ['WCAG 2.2 Level A and Level AA (W3C Recommendation).'],
    wcagVersion: '2.2',
    wcagSubset: 'A+AA',
  },
  section508: {
    key: 'section508',
    title: 'VPAT® 2.5 — Revised Section 508',
    standards: [
      'Revised Section 508 (36 CFR Part 1194); Chapter 5 references WCAG 2.0 Level A/AA.',
      'This report maps WCAG 2.2 Level A + AA — a superset of 2.0 — so the Section 508 web ' +
        'requirements are fully covered.',
    ],
    wcagVersion: '2.2',
    wcagSubset: 'A+AA',
  },
};

const RANK: Record<Conformance, number> = {
  Supports: 3,
  'Partially Supports': 2,
  'Does Not Support': 1,
  'Not Applicable': 0,
  'Not Evaluated': 0,
};

/** Weakest conformance among the applicable contributing SCs; Supports if none impede. */
function deriveConformance(byNum: Map<string, CriterionRow>, scNums: readonly string[]): Conformance {
  let weakest: Conformance = 'Supports';
  let found = false;
  for (const sc of scNums) {
    const row = byNum.get(sc);
    if (!row || row.applicability !== 'applicable') continue;
    if (row.conformance === 'Not Applicable' || row.conformance === 'Not Evaluated') continue;
    found = true;
    if (RANK[row.conformance] < RANK[weakest]) weakest = row.conformance;
  }
  return found ? weakest : 'Supports';
}

interface FpStatement {
  /** EN 301 549 §4.2.x clause. */
  en: string;
  /** Section 508 §302.x clause, or '' if 508 has no equivalent. */
  s508: string;
  name: string;
  derivedFrom: string[];
  note: string;
}

/** Functional-performance statements, mapped to the WCAG SCs that serve each (vpat-editions §3). */
const FP_STATEMENTS: readonly FpStatement[] = [
  { en: '4.2.1', s508: '302.1', name: 'Usage without vision',
    derivedFrom: ['1.1.1', '1.3.1', '2.1.1', '4.1.2', '4.1.3'],
    note: 'Keyboard-operable with screen-reader announcements and a full data-table alternative.' },
  { en: '4.2.2', s508: '302.2', name: 'Usage with limited vision',
    derivedFrom: ['1.4.3', '1.4.4', '1.4.10', '1.4.11'],
    note: 'Resizes and reflows; some contrast/zoom aspects depend on the host background and theme.' },
  { en: '4.2.3', s508: '302.3', name: 'Usage without perception of color',
    derivedFrom: ['1.4.1'],
    note: 'Series carry a distinct dash pattern (mirrored in the legend swatch) in addition to ' +
      'color, and identity is also available via the legend, data table, and readout.' },
  { en: '4.2.4', s508: '302.4', name: 'Usage without hearing', derivedFrom: [],
    note: 'No audio content is produced.' },
  { en: '4.2.5', s508: '302.5', name: 'Usage with limited hearing', derivedFrom: [],
    note: 'No audio content is produced.' },
  { en: '4.2.6', s508: '302.6', name: 'Usage without vocal capability', derivedFrom: [],
    note: 'No speech input is required.' },
  { en: '4.2.7', s508: '302.7', name: 'Usage with limited manipulation or strength',
    derivedFrom: ['2.1.1', '2.5.1', '2.5.7', '2.5.8'],
    note: 'Full keyboard operation (including zoom), and pan pagers give a single-pointer, ' +
      'non-dragging alternative to drag-pan (R4) — so pointer-only and keyboard-only users are both ' +
      'covered. Targets meet 24×24px.' },
  { en: '4.2.8', s508: '302.8', name: 'Usage with limited reach and strength',
    derivedFrom: ['2.5.8'], note: 'Interactive targets meet the 24×24px minimum.' },
  { en: '4.2.9', s508: '', name: 'Minimize photosensitive seizure triggers',
    derivedFrom: ['2.3.1'], note: 'Nothing flashes; rendering is user-driven, not strobing.' },
  { en: '4.2.10', s508: '302.9', name: 'Usage with limited cognition, language, or learning',
    derivedFrom: ['3.2.1', '3.2.2', '3.3.2', '2.2.1'],
    note: 'Predictable behavior, labeled controls with instructions, and no time limits.' },
  { en: '4.2.11', s508: '', name: 'Privacy', derivedFrom: [],
    note: 'The component handles no personal data.' },
];

/** Build the edition-specific tables (functional performance, software, documentation). */
export function buildSections(criteria: readonly CriterionRow[], edition: EditionKey): ReportSection[] {
  if (edition === 'wcag') return [];
  const byNum = new Map(criteria.map((c) => [c.num, c]));
  const is508 = edition === 'section508';

  const fpRows: SectionRow[] = FP_STATEMENTS.filter((fp) => !is508 || fp.s508 !== '').map((fp) => ({
    id: is508 ? fp.s508 : fp.en,
    name: fp.name,
    conformance: deriveConformance(byNum, fp.derivedFrom),
    remarks: fp.derivedFrom.length
      ? `${fp.note} (derived from ${fp.derivedFrom.join(', ')})`
      : fp.note,
    derivedFrom: fp.derivedFrom.length ? fp.derivedFrom : undefined,
  }));

  const software: SectionRow[] = [
    {
      id: is508 ? '502.2.1 / 502.2.2' : '11.5.2',
      name: 'Name, role, state, value of user-interface components',
      conformance: deriveConformance(byNum, ['4.1.2']),
      remarks: 'The component exposes name, role, and value for its controls (derived from 4.1.2).',
      derivedFrom: ['4.1.2'],
    },
    {
      id: is508 ? '502 / 503' : '11.6 / 11.7',
      name: 'Platform accessibility services / closed functionality',
      conformance: 'Not Applicable',
      remarks:
        'The chart runs in the host web browser; platform accessibility services and assistive-' +
        'technology interoperability are provided by the user agent and OS, not by this component.',
    },
  ];

  const docs: SectionRow[] = [
    {
      id: is508 ? '602.3' : '12.1.1',
      name: 'Accessibility and compatibility features documented',
      conformance: 'Supports',
      remarks:
        'This ACR, the README accessibility section, and llms.txt document the chart’s ' +
        'accessibility features, keyboard model, and the localizable strings option.',
    },
    {
      id: is508 ? '602.2' : '12.2.4',
      name: 'Documentation available in an accessible electronic format',
      conformance: 'Supports',
      remarks: 'Documentation is plain Markdown/HTML, itself accessible and machine-readable.',
    },
  ];

  return [
    {
      id: 'fp',
      title: is508
        ? 'Chapter 3: Functional Performance Criteria (Section 508 §302)'
        : 'Chapter 4: Functional Performance Statements (EN 301 549)',
      intro: 'Derived from the WCAG criteria that serve each statement — never stated independently.',
      rows: fpRows,
    },
    {
      id: 'software',
      title: is508 ? '§502 / §503 — Software' : 'Chapter 11: Software',
      intro:
        'fcharts is a UI component embedded in a host page; most software clauses are the ' +
        'platform/host responsibility and are marked Not Applicable.',
      rows: software,
    },
    {
      id: 'docs',
      title: is508 ? '§602 / §603 — Documentation & Support' : 'Chapter 12: Documentation & Support',
      rows: docs,
    },
  ];
}
