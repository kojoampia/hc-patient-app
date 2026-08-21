/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/shared/ui/charts/bar-chart.component.ts @ 12e418c
 * Divergence: hpd -> hpm throughout; SharedModule (never copied) replaced by the lifted TranslateDirective.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

import TranslateDirective from 'app/shared/language/translate.directive';

/** One row of the chart: a name, and one value per series. */
export interface BarRow {
  readonly label: string;
  readonly values: readonly number[];
}

/**
 * Wider than the line chart's 620: this one is laid out full width, and an SVG scaled up by a
 * third scales its type with it — 11.5px labels arriving on screen at 17px, larger than the card
 * heading above them.
 */
const WIDTH = 900;
const LABEL_W = 196;
const RIGHT_PAD = 34;
const ROW_H = 38;
const BAR_H = 12;
const BAR_GAP = 3;
const TOP = 6;

/**
 * Grouped horizontal bars — one row per name, one bar per series.
 *
 * Horizontal because the rows are labelled with people's names, and "Kwabena Adda Frimpong" under
 * a vertical bar has to be rotated or truncated to fit. Reading down a left-hand column of names
 * is also the order the eye already wants for a ranked list.
 *
 * The height is computed from the number of rows rather than fixed, so eight professionals do not
 * squeeze into the space three would have used.
 */
@Component({
  selector: 'hpm-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective],
  template: `
    @if (rows().length) {
      @if (showTable) {
        <table class="hc-viz-tbl">
          <thead>
            <tr>
              <th [hpmTranslate]="labelHeadingKey"></th>
              @for (name of series; track name) {
                <th class="hc-right">{{ name }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.label) {
              <tr>
                <td>{{ row.label }}</td>
                @for (value of row.values; track $index) {
                  <td class="hc-right">{{ value }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <div class="hc-viz">
          <svg [attr.viewBox]="'0 0 ' + width + ' ' + height()" role="img" [attr.aria-label]="summary()">
            @for (bar of bars(); track bar.key) {
              @if (bar.first) {
                <text [attr.x]="labelWidth - 12" [attr.y]="bar.rowMiddle + 4" text-anchor="end" class="hpm-bar__name">
                  {{ bar.label }}
                </text>
              }

              <rect
                [attr.x]="labelWidth"
                [attr.y]="bar.y"
                [attr.width]="bar.width"
                [attr.height]="barHeight"
                rx="3"
                [attr.fill]="bar.colour"
              >
                <title>{{ bar.label }} — {{ bar.seriesName }}: {{ bar.value }}</title>
              </rect>

              @if (bar.value) {
                <text [attr.x]="labelWidth + bar.width + 6" [attr.y]="bar.y + barHeight - 1.5" class="hpm-bar__n">{{ bar.value }}</text>
              }
            }
          </svg>
        </div>
      }
    }
  `,
  styles: [
    `
      .hpm-bar__name {
        font-size: 11.5px;
        font-weight: 700;
        fill: var(--hc-navy);
      }

      .hpm-bar__n {
        font-size: 11px;
        font-weight: 700;
        fill: var(--hc-grey-400);
      }
    `,
  ],
})
export class BarChartComponent {
  readonly width = WIDTH;
  readonly labelWidth = LABEL_W;
  readonly barHeight = BAR_H;

  /** Swaps the chart for the same numbers as a table. */
  @Input() showTable = false;

  /** One name per series, in the order the values are given. Used by the table and the tooltips. */
  @Input({ required: true }) series: readonly string[] = [];

  @Input() labelHeadingKey = 'patientPortal.chart.who';

  readonly rows = signal<readonly BarRow[]>([]);

  @Input({ required: true })
  set data(value: readonly BarRow[] | null | undefined) {
    this.rows.set(value ?? []);
  }

  readonly height = computed(() => TOP * 2 + this.rows().length * ROW_H);

  /**
   * Every bar, already placed — flattened to one list so the template draws it with a single loop
   * rather than a nested pair, which `@for` cannot index cleanly across.
   */
  readonly bars = computed(() => {
    const rows = this.rows();
    const seriesCount = Math.max(1, ...rows.map(row => row.values.length));
    const max = Math.max(1, ...rows.flatMap(row => [...row.values]));
    const plotWidth = WIDTH - LABEL_W - RIGHT_PAD;
    const groupHeight = seriesCount * BAR_H + (seriesCount - 1) * BAR_GAP;

    return rows.flatMap((row, rowIndex) => {
      const rowTop = TOP + rowIndex * ROW_H;
      const groupTop = rowTop + (ROW_H - groupHeight) / 2;
      return row.values.map((value, i) => ({
        key: `${row.label}-${i}`,
        label: row.label,
        seriesName: this.series[i] ?? '',
        value,
        first: i === 0,
        rowMiddle: rowTop + ROW_H / 2,
        y: groupTop + i * (BAR_H + BAR_GAP),
        width: (value / max) * plotWidth,
        colour: `var(--hc-series-${(i % 3) + 1})`,
      }));
    });
  });

  /** The chart's accessible name: the ranking in words. */
  readonly summary = computed(() =>
    this.rows()
      .map(row => `${row.label}: ${row.values.map((value, i) => `${value} ${this.series[i] ?? ''}`).join(', ')}`)
      .join('. '),
  );
}
