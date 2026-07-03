/**
 * fcharts Compliance Pack — the paid layer: the conformance engine, the WCAG 2.2 AA baseline,
 * and (added in task 18) the VPAT/ACR generator. Shipped as a SEPARATE entry from the MIT
 * renderer; the live engine imports Playwright (a dev/peer dependency), never bundled into core.
 */
export { CRITERIA } from './criteria.ts';
export { runConformance, countStatuses } from './conformance.ts';
export type { ConformanceOptions } from './conformance.ts';
export { reduceToVerdicts, hasRegression, CHECK_CATALOG, SC_CHECKS } from './mapping.ts';
export type { CheckSpec } from './mapping.ts';
export {
  contrastRatio,
  relativeLuminance,
  parseColor,
  composite,
  ratioOf,
  isLargeText,
  AA_NORMAL,
  AA_LARGE,
  AA_NON_TEXT,
} from './contrast.ts';
export type { Rgba } from './contrast.ts';
export { EDITIONS, buildSections } from './editions.ts';
export { buildModel, renderAcr, tally, LEGAL } from './acr.ts';
export type { BuildModelInput, AcrFormat } from './acr.ts';
export { compareAcrs, isAcrModel, renderComparison } from './compare.ts';
export type { AcrComparison, ChangeKind, CriterionChange, CriterionPresence } from './compare.ts';
export type * from './types.ts';
