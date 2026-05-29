/**
 * WCAG 2.2 AA conformance baseline for the Sightline chart component.
 *
 * Transcribed from `compliance/scope-and-evidence-map.md` (document 1 of the Compliance Pack),
 * reflecting the post-remediation source: 28 Supports / 7 Partially Supports / 20 Not Applicable,
 * plus 2 user-preference adaptations (reduced-motion = Supports, forced-colors = Partially).
 *
 * This array is the committed source of truth for the auto-generated VPAT/ACR. Every row carries
 * its conformance verdict, a VPAT "Remarks and Explanations" cell, how the claim is verified
 * (automated CI / hybrid / human attestation), and the `file:line` evidence the map cites.
 */

import type { CriterionRow } from './types.ts';

export const CRITERIA: CriterionRow[] = [
  {
    num: '1.1.1',
    name: 'Non-text Content',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Canvas is aria-hidden; a text alternative is always present (hidden data table, ' +
      'natural-language summary, and embedded JSON). Whether the integrator-supplied ' +
      'ariaLabel/axis labels meaningfully describe the chart is an authoring judgment. ' +
      '(verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Canvas removed from a11y tree (aria-hidden="true")', ref: 'src/sightline.ts:179' },
      {
        detail: 'Hidden <table> alternative with caption + scoped headers, ≤40 rows',
        ref: 'src/a11y/table-alt.ts:52-110',
      },
      {
        detail: 'Surface name + describedby summary (values+trend)',
        ref: 'src/a11y/summary.ts:88-105',
      },
    ],
  },
  {
    num: '1.2.1',
    name: 'Audio-only and Video-only (Prerecorded)',
    level: 'A',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks:
      'The component renders no audio/video; it draws vector marks plus a DOM overlay. ' +
      '(verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No audio/video produced; canvas + DOM overlay only.' }],
  },
  {
    num: '1.2.2',
    name: 'Captions (Prerecorded)',
    level: 'A',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'No synchronized media. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No synchronized media.' }],
  },
  {
    num: '1.2.3',
    name: 'Audio Description or Media Alternative (Prerecorded)',
    level: 'A',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'No video content. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No video content.' }],
  },
  {
    num: '1.2.4',
    name: 'Captions (Live)',
    level: 'AA',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'No live media; real-time data uses a text live region. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No live media; real-time data uses a text live region.' }],
  },
  {
    num: '1.2.5',
    name: 'Audio Description (Prerecorded)',
    level: 'AA',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'No video content. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No video content.' }],
  },
  {
    num: '1.3.1',
    name: 'Info and Relationships',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Table/legend/surface relationships are programmatic (scoped table headers, aria-pressed ' +
      'legend, role="application" surface). R1 closed the last gap: the data-table x-column ' +
      'header now uses the configured xLabel (falls back to "x"). (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Table caption + scoped headers', ref: 'src/a11y/table-alt.ts:68-114' },
      { detail: 'role="group" legend of aria-pressed buttons', ref: 'src/a11y/legend.ts' },
      { detail: 'xLabel threaded into the table x-column header (R1)', ref: 'src/sightline.ts' },
    ],
  },
  {
    num: '1.3.2',
    name: 'Meaningful Sequence',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'DOM is appended in reading order (legend before plot; table reads x-then-series in ' +
      'ascending sample order); .sl-root is flex-column with no order/*-reverse/float. ' +
      '(verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'DOM appended in reading order', ref: 'src/sightline.ts:197-208' },
      { detail: 'Table body reads x-then-series ascending', ref: 'src/a11y/table-alt.ts:84-101' },
      { detail: 'flex-column, no order/reverse/float', ref: 'src/a11y/styles.ts:9' },
    ],
  },
  {
    num: '1.3.3',
    name: 'Sensory Characteristics',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Instructions name keys, not shape/position; series are identified by text name and values ' +
      'by axis name, not color or location. Avoiding sensory-only language in author labels ' +
      'remains an attestation. (verified: hybrid)',
    verification: 'hybrid',
    attestationRequired: true,
    evidence: [
      { detail: 'describeChart() names keys, not spatial cues', ref: 'src/sightline.ts:335-344' },
      { detail: 'Announcements name series + axis-labeled values', ref: 'src/sightline.ts:444-453' },
    ],
  },
  {
    num: '1.3.4',
    name: 'Orientation',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'No orientation lock; .sl-root is a fluid 100% flex-column re-measured by ResizeObserver. ' +
      'No @media (orientation), transform:rotate, or screen.orientation lock. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Fluid 100% flex-column layout', ref: 'src/a11y/styles.ts:9' },
      { detail: 'ResizeObserver re-measure + re-render', ref: 'src/sightline.ts:217-218,346-357' },
    ],
  },
  {
    num: '1.3.5',
    name: 'Identify Input Purpose',
    level: 'AA',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks:
      'The chart component has no form inputs that collect information about the user. ' +
      '(verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No user-info input fields are created by the component.' }],
  },
  {
    num: '1.4.1',
    name: 'Use of Color',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Partially Supports',
    remarks:
      'Legend, table, and readout give color-free series identity, but on the canvas series are ' +
      'distinguished by color only (no per-series dash/marker), so two close lines cannot be told ' +
      'apart by a color-blind user (deferred R5). Distinguishability is a perceptual ' +
      'attestation. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Color-free identity in legend (swatch + name + state)', ref: 'src/a11y/legend.ts:40-52' },
      { detail: 'Envelope stroke uses s.color only, no setLineDash', ref: 'src/renderers/canvas2d.ts:143-147' },
    ],
  },
  {
    num: '1.4.2',
    name: 'Audio Control',
    level: 'A',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'The component plays no audio. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No audio is produced by the component.' }],
  },
  {
    num: '1.4.3',
    name: 'Contrast (Minimum)',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Partially Supports',
    remarks:
      'Library DOM text passes AA on a light background (ticks 7.56:1, body 10.31:1, readout ' +
      '16.98:1) and the legend hidden state no longer dims text (R8). Residual gaps are ' +
      'integrator-dependent: author-supplied canvas series colors (no default palette) and the ' +
      'effective host background. (verified: hybrid)',
    verification: 'hybrid',
    attestationRequired: true,
    evidence: [
      { detail: 'Tick #4b5563 = 7.56:1; body #374151 = 10.31:1 vs #fff', ref: 'src/a11y/styles.ts:16' },
      { detail: 'Readout #f9fafb on #111827 = 16.98:1 (host-independent)', ref: 'src/a11y/styles.ts:28-32' },
      { detail: 'Canvas strokes use config.color, no default palette', ref: 'src/core/model.ts:55-65' },
    ],
  },
  {
    num: '1.4.4',
    name: 'Resize Text',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Partially Supports',
    remarks:
      'Container is fluid so full-page browser zoom (the path WCAG accepts) works. Library gap: ' +
      'tick/axis-title/legend/readout font sizes are absolute px, so text-only zoom does not ' +
      'enlarge them (deferred R7); clip/overlap at 200% page-zoom needs human verification. ' +
      '(verified: hybrid)',
    verification: 'hybrid',
    attestationRequired: true,
    evidence: [
      { detail: 'Fluid container re-measures on zoom', ref: 'src/sightline.ts:217-218,346-357' },
      { detail: 'Label fonts fixed in px (11/10/12.5/12)', ref: 'src/a11y/styles.ts:16,20,42,31' },
    ],
  },
  {
    num: '1.4.5',
    name: 'Images of Text',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'All readable text is real DOM text (axis ticks/titles as spans, legend as buttons, table ' +
      'as markup). A repo-wide search confirms the canvas renders zero ' +
      'fillText/strokeText/measureText/ctx.font. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Axis ticks/titles are real <span> text', ref: 'src/a11y/ticks.ts:45-59' },
      { detail: 'No fillText/strokeText/ctx.font in renderer', ref: 'src/renderers/canvas2d.ts:59-220' },
    ],
  },
  {
    num: '1.4.10',
    name: 'Reflow',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Partially Supports',
    remarks:
      'Fluid canvas with no library min-width, reflowing wrap legend, and the 2-D chart-geometry ' +
      'exception cover reflow. Library gap: fixed-px nowrap tick labels can overlap at ~320 CSS ' +
      'px / high zoom (deferred R7); whether they overlap in a given layout needs human ' +
      'verification. (verified: hybrid)',
    verification: 'hybrid',
    attestationRequired: true,
    evidence: [
      { detail: 'Legend wraps (flex-wrap:wrap), no imposed min-width', ref: 'src/a11y/styles.ts:38' },
      { detail: '.sl-tick fixed 11px white-space:nowrap', ref: 'src/a11y/styles.ts:16' },
    ],
  },
  {
    num: '1.4.11',
    name: 'Non-text Contrast',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Partially Supports',
    remarks:
      'Focus ring --sl-focus #2563eb = 5.17:1 on white. Gaps: default grid (1.16:1), axis/border ' +
      '(1.41:1), and cursor crosshair (1.96:1) are below 3:1, and data-mark contrast is ' +
      'author-determined (no default palette); highContrast thickens strokes but does not reach ' +
      '3:1 (deferred R6). (verified: hybrid)',
    verification: 'hybrid',
    attestationRequired: true,
    evidence: [
      { detail: 'Focus ring #2563eb = 5.17:1 on white', ref: 'src/a11y/styles.ts:25' },
      { detail: 'Grid/axis/cursor alphas below 3:1', ref: 'src/renderers/canvas2d.ts:29-32' },
      { detail: 'Series marks use author colors, no default palette', ref: 'src/core/model.ts:55-65' },
    ],
  },
  {
    num: '1.4.12',
    name: 'Text Spacing',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'No library text sets line-height/letter-spacing/word-spacing that would clip under a ' +
      'user-spacing override, and there is no overflow:hidden or fixed height on visible text ' +
      '(the only letter-spacing is .12em on the short uppercase axis title). (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'No clipping text-spacing; .12em only on axis title', ref: 'src/a11y/styles.ts:16-21' },
    ],
  },
  {
    num: '1.4.13',
    name: 'Content on Hover or Focus',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'The readout is Hoverable (pointer-events:none) and Persistent (hidden only on ' +
      'pointer-leave/blur, never on a timer). R3 made it Dismissible: Escape clears readout + ' +
      'crosshair via dismissCursor() without moving focus. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Readout pointer-events:none, no dismiss timer', ref: 'src/a11y/styles.ts' },
      { detail: 'Escape -> dismissCursor() clears readout, keeps focus (R3)', ref: 'src/sightline.ts' },
    ],
  },
  {
    num: '2.1.1',
    name: 'Keyboard',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Cursor navigation, legend toggle, and zoom are all keyboard-operable. R2 added keyboard ' +
      'zoom (+/=/-/_) mirroring wheel-zoom centered on the cursor, so every pointer function now ' +
      'has a keyboard path. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Cursor nav handlers', ref: 'src/a11y/cursor.ts:43-75' },
      { detail: 'Keyboard zoom mirrors wheel-zoom (R2)', ref: 'src/sightline.ts' },
    ],
  },
  {
    num: '2.1.2',
    name: 'No Keyboard Trap',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Tab/Shift+Tab are never intercepted; onKeyDown only preventDefaults the six navigation ' +
      'keys. No focus() trap, aria-modal, or inert; drag pointer-capture is released on ' +
      'up/cancel. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Only six handled keys preventDefaulted', ref: 'src/sightline.ts:514-516' },
      { detail: 'Pointer-capture released on up/cancel', ref: 'src/sightline.ts:551,565-571' },
    ],
  },
  {
    num: '2.1.4',
    name: 'Character Key Shortcuts',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'The handled key set is only ArrowRight/Left/Up/Down/Home/End plus Shift — no single ' +
      'letter/number/punctuation shortcut and no accesskey, so there is nothing to remap or turn ' +
      'off. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Non-printable key set only (arrows/Home/End + Shift)', ref: 'src/a11y/cursor.ts:21' },
    ],
  },
  {
    num: '2.2.1',
    name: 'Timing Adjustable',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'No time limits, sessions, or countdowns. The only timers are a 150ms table-update throttle ' +
      'and a 100ms announce debounce — output coalescers that delay no user action. Integrators ' +
      'who stream data on a timer own their own pause/stop controls. (verified: hybrid)',
    verification: 'hybrid',
    attestationRequired: true,
    evidence: [
      { detail: 'Throttle/debounce timers only, no deadlines', ref: 'src/sightline.ts:72-75,417-431,455-461' },
    ],
  },
  {
    num: '2.2.2',
    name: 'Pause, Stop, Hide',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Rendering is strictly on-demand (one frame per request, no rAF recursion); no auto-motion, ' +
      'auto-scroll, blink, or auto-update by default. The only animation is a 0.08s readout fade, ' +
      'far under 5s and disabled under prefers-reduced-motion. (verified: hybrid)',
    verification: 'hybrid',
    attestationRequired: true,
    evidence: [
      { detail: 'On-demand scheduler, one frame per request', ref: 'src/core/scheduler.ts' },
      { detail: '0.08s fade, off under reduced-motion', ref: 'src/a11y/styles.ts:32,49' },
    ],
  },
  {
    num: '2.3.1',
    name: 'Three Flashes or Below Threshold',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Nothing flashes: render() does a single clearRect+repaint per user-driven frame and the ' +
      'crosshair is a static dashed line. No @keyframes/blink/strobe; cadence is bounded by user ' +
      'input. A luminance-over-time probe over arbitrary author data is a human check. ' +
      '(verified: hybrid)',
    verification: 'hybrid',
    attestationRequired: true,
    evidence: [
      { detail: 'Single clearRect+repaint per frame', ref: 'src/renderers/canvas2d.ts:59-91' },
      { detail: 'Static dashed crosshair', ref: 'src/renderers/canvas2d.ts:188-220' },
    ],
  },
  {
    num: '2.4.1',
    name: 'Bypass Blocks',
    level: 'A',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks:
      'Page-level; the chart is a single focus stop, not repeated page blocks. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'Single focus stop, not repeated page blocks.' }],
  },
  {
    num: '2.4.2',
    name: 'Page Titled',
    level: 'A',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'Page-level; the host owns the document title. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'Host owns the document title.' }],
  },
  {
    num: '2.4.3',
    name: 'Focus Order',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Focus order is legend buttons then the data surface, matching DOM/reading order; tabIndex 0 ' +
      'is the only focus-affecting statement (no positive tabindex, reorder, or autofocus). ' +
      '(verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Legend-then-surface DOM order', ref: 'src/sightline.ts:197-208' },
      { detail: 'Only tabIndex 0, no positive tabindex', ref: 'src/sightline.ts:186' },
    ],
  },
  {
    num: '2.4.4',
    name: 'Link Purpose (In Context)',
    level: 'A',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'The component renders no links. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No links rendered.' }],
  },
  {
    num: '2.4.5',
    name: 'Multiple Ways',
    level: 'AA',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'Page/site-level navigation concern. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'Page/site-level navigation concern.' }],
  },
  {
    num: '2.4.6',
    name: 'Headings and Labels',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'The component emits no section headings (host owns those) and its labels are descriptive: ' +
      'surface aria-label, legend group + buttons, table caption + scoped headers. R1 made the ' +
      'table x-column header use the configured xLabel rather than the hardcoded "x". ' +
      '(verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Descriptive surface aria-label', ref: 'src/sightline.ts' },
      { detail: 'Legend group + button labels', ref: 'src/a11y/legend.ts' },
      { detail: 'Table x-header uses configured xLabel (R1)', ref: 'src/a11y/table-alt.ts' },
    ],
  },
  {
    num: '2.4.7',
    name: 'Focus Visible',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'The data surface shows a :focus-visible ring, upgraded to a real outline under ' +
      'prefers-contrast:more and a system-color Highlight outline under forced-colors:active; ' +
      'legend buttons keep the native UA focus ring (no outline:none). (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: ':focus-visible ring on the surface', ref: 'src/a11y/styles.ts:25' },
      { detail: 'prefers-contrast + forced-colors outlines', ref: 'src/a11y/styles.ts:50-59' },
    ],
  },
  {
    num: '2.4.11',
    name: 'Focus Not Obscured (Minimum)',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Partially Supports',
    remarks:
      'The component never fully obscures its own focused surface (the readout is a small tooltip ' +
      'over a fraction of the large surface). Residual gap is integrator-dependent: host-page ' +
      'sticky headers, toolbars, or overlays could obscure the focused chart. (verified: hybrid)',
    verification: 'hybrid',
    attestationRequired: true,
    evidence: [
      { detail: 'Small readout tooltip, surface is top layer', ref: 'src/a11y/styles.ts:28-33' },
      { detail: 'Surface is the top interactive layer', ref: 'src/sightline.ts:202-204' },
    ],
  },
  {
    num: '2.5.1',
    name: 'Pointer Gestures',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'All pointer interactions are single-pointer and not path-based: drag-pan depends on the net ' +
      'horizontal delta (not the trajectory), zoom is wheel-driven, and no multipoint gesture ' +
      'exists. "Not path-based / not multipoint" is a human judgment. (verified: manual-attestation)',
    verification: 'manual-attestation',
    attestationRequired: true,
    evidence: [
      { detail: 'Drag-pan uses net delta, not trajectory', ref: 'src/sightline.ts:546-563' },
      { detail: 'Zoom is wheel-driven, no multipoint', ref: 'src/sightline.ts:536-544' },
    ],
  },
  {
    num: '2.5.2',
    name: 'Pointer Cancellation',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'No function executes on the down-event: onPointerDown only sets drag state and captures the ' +
      'pointer; the pan is reversible before release (computed against the immutable start domain) ' +
      'and finalizes on pointerup. Legend buttons activate on the up-event. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'No action on down; pan reversible, finalizes on up', ref: 'src/sightline.ts:546-571' },
      { detail: 'Native legend buttons activate on up-event', ref: 'src/a11y/legend.ts:36-38' },
    ],
  },
  {
    num: '2.5.3',
    name: 'Label in Name',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      "The legend buttons are the only controls with visible text labels, and each button's " +
      'accessible name is computed from the same visible series-name text node it displays ' +
      '(swatch is aria-hidden) — verifiable by axe label-in-name. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Button accessible name = visible series-name text', ref: 'src/a11y/legend.ts:40-52' },
    ],
  },
  {
    num: '2.5.4',
    name: 'Motion Actuation',
    level: 'A',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'No device-motion-actuated functionality. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No device-motion-actuated functionality.' }],
  },
  {
    num: '2.5.7',
    name: 'Dragging Movements',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Partially Supports',
    remarks:
      "The chart's one dragging operation — drag-to-pan — has no single-pointer non-dragging " +
      'alternative (the keyboard path satisfies 2.1.1 not 2.5.7, and wheel-zoom changes ' +
      'magnification not lateral position). Library-closable but deferred (R4). (verified: hybrid)',
    verification: 'hybrid',
    attestationRequired: true,
    evidence: [
      { detail: 'Drag-pan has no single-pointer non-dragging path', ref: 'src/sightline.ts:554-560' },
      { detail: 'Keyboard panToInclude satisfies 2.1.1 only', ref: 'src/sightline.ts:526-534' },
    ],
  },
  {
    num: '2.5.8',
    name: 'Target Size (Minimum)',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'The data surface fills the plot inset and far exceeds 24x24. R9 gave legend buttons ' +
      'min-height:24px;min-width:24px;line-height:1.1, guaranteeing 24x24 regardless of host ' +
      'fonts — assertable by a computed-box check. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Surface fills plot inset, exceeds 24x24', ref: 'src/sightline.ts:359-362' },
      { detail: 'Legend buttons min 24x24 (R9)', ref: 'src/a11y/styles.ts' },
    ],
  },
  {
    num: '3.1.1',
    name: 'Language of Page',
    level: 'A',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'Page-level; the host sets the document language. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'Host sets document language.' }],
  },
  {
    num: '3.1.2',
    name: 'Language of Parts',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'R10 made every fixed UI string (keyboard help, legend label, per-series state words, table ' +
      'caption, data summary) overridable via the strings option, so an integrator on a ' +
      'non-English page can match the document language; defaults remain English. ' +
      '(verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'SightlineStrings token-template defaults (R10)', ref: 'src/a11y/strings.ts' },
      { detail: 'strings threaded through legend/table/summary', ref: 'src/sightline.ts' },
    ],
  },
  {
    num: '3.2.1',
    name: 'On Focus',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Focusing the surface only sets cursorActive, announces the current point via the polite ' +
      'live region, and re-renders the crosshair in place — no focus move, navigation, window, or ' +
      'form submission. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Focus only activates cursor + polite announce', ref: 'src/sightline.ts:501-505' },
      { detail: 'Live region announce, no context change', ref: 'src/a11y/live-region.ts:13-14' },
    ],
  },
  {
    num: '3.2.2',
    name: 'On Input',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Navigation keys move the cursor/pan in place and legend buttons toggle visibility in place ' +
      'via toggleSeries; no path changes context (no navigation, submission, or focus move). ' +
      '(verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Keys move cursor/pan in place', ref: 'src/sightline.ts:514-534' },
      { detail: 'Legend toggle in place via toggleSeries', ref: 'src/a11y/legend.ts:36' },
    ],
  },
  {
    num: '3.2.3',
    name: 'Consistent Navigation',
    level: 'AA',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'Cross-page navigation concern; not a single component. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'Cross-page navigation concern, not a single component.' }],
  },
  {
    num: '3.2.4',
    name: 'Consistent Identification',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'All legend buttons are produced by one build() routine with identical structure (swatch + ' +
      'name + state) and uniform aria-pressed; the surface carries a stable role="application" + ' +
      'aria-roledescription on every instance. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'One build() routine, uniform aria-pressed', ref: 'src/a11y/legend.ts:31' },
      { detail: 'Stable role="application" + roledescription', ref: 'src/sightline.ts:187' },
    ],
  },
  {
    num: '3.2.6',
    name: 'Consistent Help',
    level: 'A',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'Page/site-level help mechanism concern. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'Page/site-level help mechanism concern.' }],
  },
  {
    num: '3.3.1',
    name: 'Error Identification',
    level: 'A',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'No form inputs / errors. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No form inputs / errors.' }],
  },
  {
    num: '3.3.2',
    name: 'Labels or Instructions',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Though the component has no data-entry fields, its interactive controls carry instructions: ' +
      'the surface aria-label embeds the full keyboard model plus a pointer to the data table, and ' +
      'the legend group + buttons are labeled with shown/hidden state. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Surface aria-label embeds keyboard model', ref: 'src/sightline.ts:335-344' },
      { detail: 'Legend group + button labels with state', ref: 'src/a11y/legend.ts:25,69-75' },
    ],
  },
  {
    num: '3.3.3',
    name: 'Error Suggestion',
    level: 'AA',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'No form inputs / errors. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No form inputs / errors.' }],
  },
  {
    num: '3.3.4',
    name: 'Error Prevention (Legal, Financial, Data)',
    level: 'AA',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'No transactions / legal commitments. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No transactions / legal commitments.' }],
  },
  {
    num: '3.3.7',
    name: 'Redundant Entry',
    level: 'A',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'No multi-step entry of information. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No multi-step entry of information.' }],
  },
  {
    num: '3.3.8',
    name: 'Accessible Authentication (Minimum)',
    level: 'AA',
    applicability: 'not-applicable',
    conformance: 'Not Applicable',
    remarks: 'No authentication. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [{ detail: 'No authentication.' }],
  },
  {
    num: '4.1.2',
    name: 'Name, Role, Value',
    level: 'A',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Name and Role are exposed for every control. R11 closed the Value half: the focused sample ' +
      'is a queryable aria-describedby target (sl-active-{n}) updated in lockstep with each cursor ' +
      'move, and the legend state span is aria-hidden so each name stays the stable series name. ' +
      '(verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Surface role/name/details + native legend buttons', ref: 'src/sightline.ts' },
      { detail: 'Lockstep aria-describedby value target (R11)', ref: 'src/sightline.ts' },
      { detail: 'Native table with scoped headers', ref: 'src/a11y/table-alt.ts' },
    ],
  },
  {
    num: '4.1.3',
    name: 'Status Messages',
    level: 'AA',
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'Cursor moves not conveyed through focus are announced via a dedicated aria-live="polite" ' +
      'aria-atomic="true" region appended at construction, debounced 100ms. Presence + ' +
      'DOM-before-update ordering are automatable; that announcements are actually spoken from ' +
      'inside role="application" is attested. (verified: hybrid)',
    verification: 'hybrid',
    attestationRequired: true,
    evidence: [
      { detail: 'Live region created before updates', ref: 'src/a11y/live-region.ts:11-22' },
      { detail: 'Debounced announce, fires on focus', ref: 'src/sightline.ts:443-461,501-505' },
    ],
  },
  {
    num: 'reduced-motion',
    name: 'prefers-reduced-motion support',
    level: 'AA',
    adaptation: true,
    applicability: 'applicable',
    conformance: 'Supports',
    remarks:
      'The only shipped CSS transition (0.08s readout fade) is removed under ' +
      'prefers-reduced-motion:reduce, and the reducedMotion option is auto-detected via matchMedia ' +
      'and threaded into every RenderScene. There is essentially no decorative/looping motion to ' +
      'suppress. (verified: automated)',
    verification: 'automated',
    attestationRequired: false,
    evidence: [
      { detail: 'Readout fade removed under reduced-motion', ref: 'src/a11y/styles.ts:32,49' },
      { detail: 'reducedMotion auto-detected and plumbed', ref: 'src/sightline.ts:143-144,406,634-636' },
    ],
  },
  {
    num: 'forced-colors',
    name: 'Windows High Contrast Mode (forced-colors)',
    level: 'AA',
    adaptation: true,
    applicability: 'applicable',
    conformance: 'Partially Supports',
    remarks:
      'The DOM overlay adapts and the focus indicator is preserved (forced-colors:active gives the ' +
      'surface an outline:2px solid Highlight; DOM text/buttons remap to system colors). Inherent ' +
      'gap: the canvas bitmap cannot participate in forced-colors, so series/grid/crosshair stay ' +
      'author-supplied — the DOM data alternatives carry the user through (deferred R12). ' +
      '(verified: hybrid)',
    verification: 'hybrid',
    attestationRequired: true,
    evidence: [
      { detail: 'forced-colors outline + remapped DOM colors', ref: 'src/a11y/styles.ts:55-59' },
      { detail: 'Canvas marks not remapped by forced-colors', ref: 'src/renderers/canvas2d.ts:24-34' },
      { detail: 'DOM data alternatives remain in adapting DOM', ref: 'src/a11y/table-alt.ts:75-110' },
    ],
  },
];
