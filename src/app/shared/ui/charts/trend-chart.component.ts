/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/shared/ui/charts/trend-chart.component.ts @ 12e418c
 * Divergence: SharedModule -> TranslateModule; the [hpmTranslate] directive becomes a translate pipe. SharedModule is never copied (§7.2) — it exports NgbModule and FontAwesomeModule, which would drag ng-bootstrap and Font Awesome into the bundle for nothing.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

import { TranslateModule } from '@ngx-translate/core';

/** One plotted reading. */
export interface TrendPoint {
  /** X-axis label — a date, a month, a week offset. */
  readonly label: string;
  readonly value: number;
}

const WIDTH = 620;
const HEIGHT = 200;
const PAD = { left: 34, right: 16, top: 16, bottom: 28 };

/**
 * A single-series line chart with an area fill, gridlines and value labels.
 *
 * Sized by a `viewBox` and scaled by CSS, so it needs no resize observer and prints correctly.
 * The same numbers are always available as a table via the `showTable` input — the chart is the
 * quick read, the table is the accessible one, and a reading nobody can get to is not a reading.
 */
@Component({
  selector: 'hpm-trend-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  template: `
    @if (points().length > 1) {
      @if (showTable) {
        <table class="hc-viz-tbl">
          <thead>
            <tr>
              <th>{{ labelHeadingKey | translate }}</th>
              <th class="hc-right">{{ unit }}</th>
            </tr>
          </thead>
          <tbody>
            @for (point of points(); track point.label) {
              <tr>
                <td>{{ point.label }}</td>
                <td class="hc-right">{{ point.value }}</td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <div class="hc-viz">
          <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="summary()">
            <defs>
              <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--hc-series-1)" stop-opacity="0.20" />
                <stop offset="100%" stop-color="var(--hc-series-1)" stop-opacity="0" />
              </linearGradient>
            </defs>

            @for (tick of ticks(); track tick.value) {
              <line [attr.x1]="pad.left" [attr.x2]="width - pad.right" [attr.y1]="tick.y" [attr.y2]="tick.y" stroke="var(--hc-grid)" />
              <text [attr.x]="pad.left - 8" [attr.y]="tick.y + 4" text-anchor="end" class="hpm-axis">{{ tick.value }}</text>
            }

            <path [attr.d]="area()" [attr.fill]="'url(#' + gradientId + ')'" />
            <path
              [attr.d]="line()"
              fill="none"
              stroke="var(--hc-series-1)"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            @for (dot of coords(); track dot.label) {
              <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="3.6" fill="var(--hc-surface-1)" stroke="var(--hc-series-1)" stroke-width="2">
                <title>{{ dot.label }}: {{ dot.value }} {{ unit }}</title>
              </circle>
              <text [attr.x]="dot.x" [attr.y]="height - 9" text-anchor="middle" class="hpm-axis">{{ dot.label }}</text>
            }
          </svg>
        </div>
      }
    }
  `,
  styles: [
    `
      .hpm-axis {
        font-size: 10.5px;
        font-weight: 600;
        fill: var(--hc-grey-400);
      }
    `,
  ],
})
export class TrendChartComponent {
  /**
   * Scale bounds, padded above and below so the line never touches the frame.
   *
   * Padding below the minimum is dropped the moment it would go negative: a series of counts has a
   * real floor at zero, and an axis labelled −1.7 visits invites the reader to believe the scale
   * means something it does not. {@link wholeNumbers} goes further and puts the floor at zero
   * outright, so the bar heights stay proportional to the counts they represent.
   *
   * Declared above `points`, which it reads: a computed body is lazy, so it does not run until
   * something reads it — long after every field is initialised.
   */
  private readonly bounds = computed(() => {
    const values = this.points().map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    if (this.wholeNumbers) {
      // Rounded up to a multiple of four, so all five gridlines land on whole numbers.
      return { low: 0, high: Math.max(4, Math.ceil((max * 1.15) / 4) * 4) };
    }
    const low = min - span * 0.35;
    return { low: min >= 0 ? Math.max(0, low) : low, high: max + span * 0.35 };
  });

  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly pad = PAD;
  readonly gradientId = `hpm-trend-${nextId()}`;

  @Input() unit = '';

  /** Swaps the chart for the same numbers as a table. */
  @Input() showTable = false;

  /** Column heading for the label column in table mode. */
  @Input() labelHeadingKey = 'patientPortal.chart.when';

  /** Set for a series of counts: the axis starts at zero and every gridline is a whole number. */
  @Input() wholeNumbers = false;

  readonly points = signal<readonly TrendPoint[]>([]);

  @Input({ required: true })
  set data(value: readonly TrendPoint[] | null | undefined) {
    this.points.set(value ?? []);
  }

  readonly coords = computed(() => {
    const points = this.points();
    const { low, high } = this.bounds();
    const innerWidth = WIDTH - PAD.left - PAD.right;
    const innerHeight = HEIGHT - PAD.top - PAD.bottom;
    return points.map((point, i) => ({
      ...point,
      x: PAD.left + (i / (points.length - 1)) * innerWidth,
      y: PAD.top + innerHeight - ((point.value - low) / (high - low)) * innerHeight,
    }));
  });

  /** Four evenly spaced gridlines, labelled with the value they sit at. */
  readonly ticks = computed(() => {
    const { low, high } = this.bounds();
    const innerHeight = HEIGHT - PAD.top - PAD.bottom;
    return [0, 0.25, 0.5, 0.75, 1].map(fraction => {
      const value = low + fraction * (high - low);
      return {
        value: Math.round(value * 10) / 10,
        y: PAD.top + innerHeight - fraction * innerHeight,
      };
    });
  });

  readonly line = computed(() =>
    this.coords()
      .map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' '),
  );

  readonly area = computed(() => {
    const coords = this.coords();
    if (coords.length < 2) {
      return '';
    }
    const baseline = PAD.top + (HEIGHT - PAD.top - PAD.bottom);
    return `${this.line()} L${coords.at(-1)!.x.toFixed(1)} ${baseline} L${coords[0].x.toFixed(1)} ${baseline} Z`;
  });

  /** The chart's accessible name: the trajectory in words, not "line chart". */
  readonly summary = computed(() => {
    const points = this.points();
    if (points.length < 2) {
      return '';
    }
    const first = points[0];
    const last = points.at(-1)!;
    const direction = last.value > first.value ? 'up' : last.value < first.value ? 'down' : 'level';
    return `${first.value} ${this.unit} on ${first.label} to ${last.value} ${this.unit} on ${last.label}, trending ${direction}.`;
  });
}

let counter = 0;
function nextId(): number {
  return ++counter;
}
