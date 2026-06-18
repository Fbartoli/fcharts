/**
 * WCAG contrast math — hand-rolled, zero dependencies.
 *
 * Implements the WCAG 2.x relative-luminance and contrast-ratio definitions, plus a color
 * parser (hex / rgb() / rgba()) and alpha compositing so low-opacity colors (grid lines, faded
 * text) can be measured against a known background. Pure; unit-tested under node:test.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0..1; 1 = opaque. */
  a: number;
}

/** WCAG AA text contrast threshold for a given font: 3:1 for large text, else 4.5:1. */
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
/** Non-text (UI components, graphical objects) threshold. */
export const AA_NON_TEXT = 3;

/** "Large text" per WCAG: ≥ 24px, or ≥ 18.66px when bold. */
export function isLargeText(fontPx: number, bold: boolean): boolean {
  return fontPx >= 24 || (bold && fontPx >= 18.66);
}

/** Parse one rgb()/rgba() channel: `'50%'` → 127.5, `'128'` → 128. */
function chan(p: string): number {
  return p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p);
}

/** Parse a CSS color string (`#rgb`, `#rrggbb`, `rgb(...)`, `rgba(...)`) to RGBA, or null. */
export function parseColor(css: string): Rgba | null {
  const s = css.trim().toLowerCase();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
        a: 1,
      };
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgb = s.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[,/]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) return null;
    const r = chan(parts[0]);
    const g = chan(parts[1]);
    const b = chan(parts[2]);
    const a = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
    return { r, g, b, a };
  }
  return null;
}

/** Composite a (possibly translucent) foreground over an opaque background → opaque RGB. */
export function composite(fg: Rgba, bg: Rgba): Rgba {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/** Linearize one sRGB channel (0..255) per the WCAG relative-luminance definition. */
function lin(c: number): number {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque color (channels 0..255). */
export function relativeLuminance({ r, g, b }: Rgba): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Contrast ratio (1..21) between two colors. A translucent foreground is composited over the
 * background first; the background is assumed opaque (composite it over white if not).
 */
export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const bgOpaque = bg.a < 1 ? composite(bg, { r: 255, g: 255, b: 255, a: 1 }) : bg;
  const fgOpaque = fg.a < 1 ? composite(fg, bgOpaque) : fg;
  const l1 = relativeLuminance(fgOpaque);
  const l2 = relativeLuminance(bgOpaque);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Convenience: contrast ratio from two CSS color strings, or null if either fails to parse. */
export function ratioOf(fgCss: string, bgCss: string): number | null {
  const fg = parseColor(fgCss);
  const bg = parseColor(bgCss);
  if (!fg || !bg) return null;
  return contrastRatio(fg, bg);
}
