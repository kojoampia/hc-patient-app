/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/shared/ui/charts/sparkline.component.ts @ 12e418c
 * Divergence: hpd -> hpm throughout; SharedModule (never copied) replaced by the lifted TranslateDirective.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

const WIDTH = 200;
const HEIGHT = 44;
const PAD_X = 2;
const PAD_TOP = 6;
const PAD_BOTTOM = 8;

/**
 * The thumbnail trend line inside a vital tile.
 *
 * Drawn as SVG with a `viewBox` rather than a canvas, so it scales with the tile and survives a
 * print at full resolution. It carries no axes, labels or tooltip on purpose — it shows shape,
 * and the tile beside it shows the number.
 */
@Component({
  selector: 'hpm-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (points().length > 1) {
      <svg class="hc-spark" [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none" role="img" [attr.aria-label]="label">
        <defs>
          <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [attr.stop-color]="colour" stop-opacity="0.22" />
            <stop offset="100%" [attr.stop-color]="colour" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path [attr.d]="area()" [attr.fill]="'url(#' + gradientId + ')'" />
        <path [attr.d]="line()" fill="none" [attr.stroke]="colour" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    }
  `,
})
export class SparklineComponent {
  /**
   * Maps each reading to a coordinate. A flat series is centred rather than dividing by zero.
   *
   * Declared above `points`, which it reads: a computed body is lazy, so it does not run until
   * something reads it — long after every field is initialised.
   */
  private readonly coords = computed<readonly [number, number][]>(() => {
    const data = this.points();
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const usable = HEIGHT - PAD_TOP - PAD_BOTTOM;
    return data.map((value, i) => [
      (i / (data.length - 1)) * (WIDTH - PAD_X * 2) + PAD_X,
      HEIGHT - PAD_BOTTOM - ((value - min) / span) * usable,
    ]);
  });

  readonly width = WIDTH;
  readonly height = HEIGHT;

  /** Unique per instance so two sparklines on one screen do not share a gradient. */
  readonly gradientId = `hpm-spark-${nextId()}`;

  @Input() colour = 'var(--hc-series-1)';

  /** Accessible name — the tile's label plus its current reading reads better than "chart". */
  @Input() label = '';

  readonly points = signal<readonly number[]>([]);

  @Input({ required: true })
  set series(value: readonly number[] | null | undefined) {
    this.points.set(value ?? []);
  }

  readonly line = computed(() =>
    this.coords()
      .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(' '),
  );

  readonly area = computed(() => {
    const coords = this.coords();
    if (coords.length < 2) {
      return '';
    }
    const last = coords.at(-1)!;
    return `${this.line()} L${last[0].toFixed(1)} ${HEIGHT} L${coords[0][0].toFixed(1)} ${HEIGHT} Z`;
  });
}

let counter = 0;
function nextId(): number {
  return ++counter;
}
