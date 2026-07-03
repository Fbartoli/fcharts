/**
 * Vue 3 adapter — a thin, declarative `<FChart>` wrapper around the imperative {@link FChart}
 * class, mirroring the React adapter's contract: mount once, forward identity-changed props via
 * `chart.update()`, remount only when a construction-fixed option (`legend`, `sonify`,
 * `exportControl`, `strings`) changes, destroy on unmount.
 *
 * Vue is an *optional peer dependency*: this module ships as the separate `fcharts-js/vue`
 * entry and `vue` is externalized from the build, so the core renderer never pulls Vue in.
 * Non-prop attributes (`class`, `style`, …) fall through to the container div — give it a
 * height like any chart mount.
 */
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from 'vue';
import { FChart as FChartCore, sameConstructionOptions, type FChartOptions } from './fchart.ts';
import type { AnnotationSpec, FChartData, SeriesConfig } from './core/model.ts';

/** Declarative fcharts chart for Vue 3. Pass *stable* `data`/`series`/`options` references —
 *  each identity change is forwarded as an update (a new `data` reference resets the view). */
export const FChart = defineComponent({
  name: 'FChart',
  props: {
    series: { type: Array as PropType<SeriesConfig[]>, required: true },
    data: { type: Object as PropType<FChartData>, default: undefined },
    options: { type: Object as PropType<FChartOptions>, default: undefined },
    annotations: { type: Array as PropType<AnnotationSpec[]>, default: undefined },
  },
  setup(props) {
    const container = ref<HTMLDivElement | null>(null);
    let chart: FChartCore | null = null;

    const mount = (): void => {
      if (container.value) {
        chart = new FChartCore(container.value, {
          series: props.series,
          data: props.data,
          options: props.options,
          annotations: props.annotations,
        });
      }
    };
    onMounted(mount);
    onBeforeUnmount(() => {
      chart?.destroy();
      chart = null;
    });

    watch(
      () => props.options,
      (next, prev) => {
        if (sameConstructionOptions(prev, next)) {
          chart?.update({ options: next });
        } else {
          chart?.destroy();
          chart = null;
          mount();
        }
      },
    );
    watch(
      () => props.series,
      (series) => chart?.update({ series }),
    );
    watch(
      () => props.data,
      (data) => {
        if (data) chart?.update({ data });
      },
    );
    watch(
      () => props.annotations,
      (annotations) => chart?.update({ annotations: annotations ?? [] }),
    );

    return () => h('div', { ref: container });
  },
});
