/**
 * Render scheduler — coalesces many state changes into a single animation frame.
 *
 * Interaction handlers (zoom, pan, cursor moves) and data updates all call `request()`.
 * No matter how many fire before the next frame, `onFrame` runs exactly once per frame,
 * and only when something is dirty (render-on-demand — idle charts cost nothing).
 */

export type FrameCallback = (now: number) => void;

/** Injected animation-frame primitives (overridable for tests / non-DOM environments). */
export interface FrameClock {
  request(cb: (now: number) => void): number;
  cancel(handle: number): void;
}

function fallbackNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

function defaultClock(): FrameClock {
  const raf = typeof globalThis.requestAnimationFrame === 'function';
  if (raf) {
    return {
      request: (cb) => globalThis.requestAnimationFrame(cb),
      cancel: (h) => globalThis.cancelAnimationFrame(h),
    };
  }
  return {
    request: (cb) => setTimeout(() => cb(fallbackNow()), 16) as unknown as number,
    cancel: (h) => clearTimeout(h),
  };
}

export class RenderScheduler {
  private dirty = false;
  private handle = 0;
  private disposed = false;
  private readonly onFrame: FrameCallback;
  private readonly clock: FrameClock;

  constructor(onFrame: FrameCallback, clock?: FrameClock) {
    this.onFrame = onFrame;
    this.clock = clock ?? defaultClock();
  }

  /** Mark the chart dirty and ensure a frame is scheduled. Idempotent within a frame. */
  request(): void {
    if (this.disposed || this.dirty) return;
    this.dirty = true;
    this.handle = this.clock.request(this.tick);
  }

  /** True while a frame is pending — useful for tests and instrumentation. */
  get pending(): boolean {
    return this.dirty;
  }

  /** Drop any pending frame without disposing the scheduler (e.g. before a sync render). */
  cancel(): void {
    if (this.handle) this.clock.cancel(this.handle);
    this.handle = 0;
    this.dirty = false;
  }

  private readonly tick = (now: number): void => {
    this.handle = 0;
    this.dirty = false;
    if (this.disposed) return;
    this.onFrame(now);
  };

  destroy(): void {
    this.disposed = true;
    if (this.handle) this.clock.cancel(this.handle);
    this.handle = 0;
    this.dirty = false;
  }
}
