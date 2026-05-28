import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderScheduler, type FrameClock } from '../src/core/scheduler.ts';

/** A hand-driven frame clock: frames fire only when the test calls flush(). */
function manualClock(): { clock: FrameClock; flush: (now?: number) => void; pending: () => boolean } {
  let cb: ((now: number) => void) | null = null;
  let handle = 0;
  return {
    clock: {
      request: (fn) => {
        cb = fn;
        return ++handle;
      },
      cancel: () => {
        cb = null;
      },
    },
    flush: (now = 0) => {
      const fn = cb;
      cb = null;
      if (fn) fn(now);
    },
    pending: () => cb !== null,
  };
}

test('coalesces many requests into a single frame', () => {
  const m = manualClock();
  let frames = 0;
  const s = new RenderScheduler(() => frames++, m.clock);
  s.request();
  s.request();
  s.request();
  assert.equal(frames, 0, 'no synchronous render');
  assert.equal(s.pending, true);
  m.flush();
  assert.equal(frames, 1, 'exactly one frame for three requests');
  assert.equal(s.pending, false);
});

test('render-on-demand: no frame fires without a request', () => {
  const m = manualClock();
  let frames = 0;
  new RenderScheduler(() => frames++, m.clock);
  assert.equal(m.pending(), false);
  m.flush();
  assert.equal(frames, 0);
});

test('re-requesting after a frame schedules another', () => {
  const m = manualClock();
  let frames = 0;
  const s = new RenderScheduler(() => frames++, m.clock);
  s.request();
  m.flush();
  s.request();
  m.flush();
  assert.equal(frames, 2);
});

test('a request made during onFrame continues the loop', () => {
  const m = manualClock();
  let frames = 0;
  const s = new RenderScheduler(() => {
    frames++;
    if (frames < 3) s.request(); // self-perpetuating, like an animation
  }, m.clock);
  s.request();
  m.flush();
  assert.equal(frames, 1);
  m.flush();
  assert.equal(frames, 2);
  m.flush();
  assert.equal(frames, 3);
  assert.equal(m.pending(), false, 'loop stops when no longer requested');
});

test('destroy cancels pending frames and ignores later requests', () => {
  const m = manualClock();
  let frames = 0;
  const s = new RenderScheduler(() => frames++, m.clock);
  s.request();
  s.destroy();
  m.flush();
  assert.equal(frames, 0, 'pending frame cancelled');
  s.request();
  assert.equal(m.pending(), false, 'no scheduling after destroy');
});

test('falls back to a clock when none injected (smoke)', () => {
  // Constructing without a clock must not throw in a non-DOM environment.
  const s = new RenderScheduler(() => {});
  assert.equal(s.pending, false);
  s.destroy();
});
