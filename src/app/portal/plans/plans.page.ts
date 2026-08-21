/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/plans/plans.component.ts @ 12e418c
 * Divergence: Resource<T> streams (§7.5), and the progress figures are now `null` rather than 0
 *   while loading or failed — see `dietPercent`. The two-column grid becomes one column (mobile.scss
 *   collapses it anyway) and the sections stack.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { ICarePlanItem } from 'app/entities/patientMS/care-plan-item/care-plan-item.model';
import { CarePlanItemService } from 'app/entities/patientMS/care-plan-item/service/care-plan-item.service';
import { IconComponent } from 'app/shared/ui/icon/icon.component';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import TranslateDirective from 'app/shared/language/translate.directive';

import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { LOADING, Resource, isLoaded, rowsOf } from '../data/resource';

type PlanRow = ICarePlanItem & { done: boolean };

/**
 * The diet and exercise plan, as a tick list the patient works through.
 *
 * Ticking an item writes straight through to the server. The optimistic set is kept locally so the
 * checkbox responds immediately, and is rolled back if the write fails — a tick that silently did
 * not save is worse than one that visibly bounced.
 */
@Component({
  selector: 'hpm-plans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, TranslateDirective, PortalPageComponent, StreamComponent, IconComponent],
  templateUrl: './plans.page.html',
  styleUrl: './plans.page.scss',
})
export class PlansPage {
  private readonly data = inject(PortalDataService);
  private readonly carePlanItemService = inject(CarePlanItemService);

  /** Local overrides applied on top of the server's answer, keyed by item id. */
  private readonly pending = signal<ReadonlyMap<string, boolean>>(new Map());

  readonly carePlan = toSignal(this.data.carePlan$, { initialValue: LOADING as Resource<readonly ICarePlanItem[]> });

  readonly diet = computed(() => this.section('DIET'));
  readonly exercise = computed(() => this.section('EXERCISE'));

  readonly dietDone = computed(() => this.diet().filter(item => item.done).length);
  readonly exerciseDone = computed(() => this.exercise().filter(item => item.done).length);

  /**
   * `null`, not 0, while loading or failed — §7.5's rule about deriving across streams.
   *
   * The web computes `percent(0, 0)` = 0 in both cases, so a dropped connection renders a progress
   * bar reading **0%** and "0 of 0 done". That is a statement about how the patient is getting on
   * with their care plan, made on no evidence. The template renders nothing at all instead.
   */
  readonly dietPercent = computed(() => (isLoaded(this.carePlan()) ? percent(this.dietDone(), this.diet().length) : null));
  readonly exercisePercent = computed(() => (isLoaded(this.carePlan()) ? percent(this.exerciseDone(), this.exercise().length) : null));

  toggle(item: PlanRow): void {
    const next = !item.done;
    this.setPending(item.id, next);

    this.carePlanItemService.partialUpdate({ id: item.id, completed: next }).subscribe({
      error: () => this.setPending(item.id, item.done),
    });
  }

  private setPending(id: string, value: boolean): void {
    const map = new Map(this.pending());
    map.set(id, value);
    this.pending.set(map);
  }

  /** One plan section, in the order the care team wrote it. */
  private section(planType: 'DIET' | 'EXERCISE'): readonly PlanRow[] {
    const overrides = this.pending();
    return rowsOf(this.carePlan())
      .filter(item => item.planType === planType)
      .map(item => ({ ...item, done: overrides.get(item.id) ?? item.completed ?? false }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }
}

function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
