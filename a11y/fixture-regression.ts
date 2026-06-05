/**
 * A deliberately-regressed fixture for the injected-regression demo (ci-gate.md §4): it mounts
 * the same chart, then injects integrator CSS that shrinks the legend targets below the 24×24px
 * minimum (WCAG 2.5.8) — exactly the kind of regression the gate must catch. Running
 * `fcharts-audit` against this fixture fails the `target-size` check and exits non-zero.
 */
import { mountChart as mountGood } from './fixture.ts';

export function mountChart(el: HTMLElement): () => void {
  const teardown = mountGood(el);
  const style = document.createElement('style');
  style.id = 'injected-regression';
  style.textContent =
    '.fc-legend button{min-height:0!important;min-width:0!important;' +
    'line-height:1!important;padding:0!important;font-size:8px!important}';
  document.head.append(style);
  return () => {
    style.remove();
    teardown();
  };
}
