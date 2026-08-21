/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/shared/ui/charts/stack-bar.component.ts @ 12e418c
 * Divergence: hpd -> hpm throughout; SharedModule (never copied) replaced by the lifted TranslateDirective.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

import TranslateDirective from 'app/shared/language/translate.directive';

/** One slice of the whole. */
export interface StackSegment {
  readonly label: string;
  readonly value: number;
}

const WIDTH = 620;
const HEIGHT = 46;
const BAR_Y = 9;
const BAR_H = 28;

/** A segment narrower than this has no room for its number, so the number is left off. */
const LABEL_MIN = 42;

/**
 * One horizontal bar divided into its parts — how a whole splits, at a glance.
 *
 * Chosen over a pie for the case-status breakdown because the question a patient asks of it is
 * "how much of my record is still open?", which is a length comparison against a known total, and
 * lengths are read more accurately than angles. It also survives being printed in greyscale, which
 * a three-slice pie does not.
 *
 * As everywhere in `charts`, the same numbers are one press away as a table.
 */
@Component({
  selector: 'hpm-stack-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective],
  template: `
    @if (total() > 0) {
      @if (showTable) {
        <table class="hc-viz-tbl">
          <thead>
            <tr>
              <th [hpmTranslate]="labelHeadingKey"></th>
              <th class="hc-right" [hpmTranslate]="valueHeadingKey"></th>
              <th class="hc-right" hpmTranslate="patientPortal.chart.share">Share</th>
            </tr>
          </thead>
          <tbody>
            @for (part of parts(); track part.label) {
              <tr>
                <td>{{ part.label }}</td>
                <td class="hc-right">{{ part.value }}</td>
                <td class="hc-right">{{ part.percent }}%</td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <div class="hc-viz">
          <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="summary()">
            <defs>
              <clipPath [attr.id]="clipId">
                <rect x="0" [attr.y]="barY" [attr.width]="width" [attr.height]="barH" rx="8" />
              </clipPath>
            </defs>

            <g [attr.clip-path]="'url(#' + clipId + ')'">
              @for (part of parts(); track part.label) {
                <rect [attr.x]="part.x" [attr.y]="barY" [attr.width]="part.width" [attr.height]="barH" [attr.fill]="part.colour">
                  <title>{{ part.label }}: {{ part.value }} ({{ part.percent }}%)</title>
                </rect>
              }
            </g>

            @for (part of parts(); track part.label) {
              @if (part.width >= labelMin) {
                <text [attr.x]="part.x + part.width / 2" [attr.y]="barY + barH / 2 + 4" text-anchor="middle" class="hpm-stack__n">
                  {{ part.value }}
                </text>
              }
            }
          </svg>
        </div>
      }
    }
  `,
  styles: [
    `
      .hpm-stack__n {
        font-size: 12px;
        font-weight: 800;
        fill: #fff;
      }
    `,
  ],
})
export class StackBarComponent {
  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly barY = BAR_Y;
  readonly barH = BAR_H;
  readonly labelMin = LABEL_MIN;
  readonly clipId = `hpm-stack-${nextId()}`;

  /** Swaps the chart for the same numbers as a table. */
  @Input() showTable = false;

  @Input() labelHeadingKey = 'patientPortal.chart.status';
  @Input() valueHeadingKey = 'patientPortal.chart.count';

  readonly segments = signal<readonly StackSegment[]>([]);

  @Input({ required: true })
  set data(value: readonly StackSegment[] | null | undefined) {
    this.segments.set((value ?? []).filter(segment => segment.value > 0));
  }

  readonly total = computed(() => this.segments().reduce((sum, segment) => sum + segment.value, 0));

  /**
   * Each segment placed along the bar.
   *
   * Widths accumulate from the running offset rather than being rounded independently, so the last
   * segment always ends exactly at the full width — rounding each one separately leaves a hairline
   * of background showing at the end of the bar.
   */
  readonly parts = computed(() => {
    const total = this.total();
    let x = 0;
    return this.segments().map((segment, i) => {
      const start = x;
      x += (segment.value / total) * WIDTH;
      return {
        ...segment,
        x: start,
        width: x - start,
        percent: Math.round((segment.value / total) * 100),
        colour: `var(--hc-series-${(i % 3) + 1})`,
      };
    });
  });

  /** The chart's accessible name: the split in words. */
  readonly summary = computed(
    () =>
      this.parts()
        .map(part => `${part.value} ${part.label.toLowerCase()}`)
        .join(', ') + '.',
  );
}

let counter = 0;
function nextId(): number {
  return ++counter;
}
