/**
 * Sonification — an audible channel for the focused data point (the EU data-visualisation guide
 * lists "sonification" as a non-visual technique). As the keyboard cursor moves, a short tone
 * sounds whose pitch maps the value within its series' range, so a blind user can *hear* the
 * shape of the data, not only read it. Opt-in (`options.sonify`); zero dependencies (Web Audio).
 *
 * The AudioContext is created lazily on first use — browsers require a user gesture (the keypress
 * that moves the cursor qualifies) — and closed on destroy.
 */

type AudioCtor = typeof AudioContext;

export class Sonifier {
  private ctx: AudioContext | null = null;
  private readonly Ctor: AudioCtor | undefined;

  constructor(view: Window) {
    const w = view as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    this.Ctor = w.AudioContext ?? w.webkitAudioContext;
  }

  /**
   * Play a short tone for `value` within [min, max] — pitch rises with the value across ~2
   * octaves (220–880 Hz). No-op if Web Audio is unavailable or the range is degenerate.
   */
  play(value: number, min: number, max: number): void {
    if (!this.Ctor) return;
    if (!this.ctx) {
      try {
        this.ctx = new this.Ctor();
      } catch {
        return;
      }
    }
    const ctx = this.ctx;
    if (ctx.state === 'suspended') void ctx.resume();
    const span = max - min;
    const norm = span > 0 ? Math.min(1, Math.max(0, (value - min) / span)) : 0.5;
    const freq = 220 * 2 ** (norm * 2); // 220 Hz (min) → 880 Hz (max)
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    // Short pluck envelope so rapid cursor movement doesn't blur into a drone.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  destroy(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}
