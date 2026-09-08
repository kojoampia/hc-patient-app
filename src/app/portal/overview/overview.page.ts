/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/overview/overview.component.ts @ 12e418c
 * Divergence: Resource<T> streams (§7.5) — and this screen is WHERE THAT RULE BITES HARDEST, since
 *   almost everything on it is a count derived across a stream; see `tiles` and `heroSummary`. The
 *   three analytics charts (visit trend, case distribution, care-team load) are dropped: they are
 *   wide multi-series figures for a desktop, and at 390px they are unreadable rather than merely
 *   small. The vitals trend stays, because it is the one chart a patient opens this screen for.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { IActivityLog } from 'app/entities/patientMS/activity-log/activity-log.model';
import { IAllergy } from 'app/entities/patientMS/allergy/allergy.model';
import { ICarePlanItem } from 'app/entities/patientMS/care-plan-item/care-plan-item.model';
import { IClinicalCase } from 'app/entities/patientMS/clinical-case/clinical-case.model';
import { IEmergency } from 'app/entities/patientMS/emergency/emergency.model';
import { IMedication } from 'app/entities/patientMS/medication/medication.model';
import { IProfile } from 'app/entities/patientMS/profile/profile.model';
import { IReport } from 'app/entities/patientMS/report/report.model';
import { IStat } from 'app/entities/patientMS/stat/stat.model';
import { ITask } from 'app/entities/patientMS/task/task.model';
import { IconComponent } from 'app/shared/ui/icon/icon.component';
import { IconName } from 'app/shared/ui/icon/icon.constants';
import { PanelComponent } from 'app/shared/ui/panel/panel.component';
import { TrendChartComponent } from 'app/shared/ui/charts/trend-chart.component';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { PortalNavService } from 'app/shell/portal-nav.service';

import { CareTeamMember, PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { StatusLabelPipe } from '../data/status-label.pipe';
import { LOADING, Resource, isLoaded, rowsOf } from '../data/resource';
import { VitalSummary, summariseVitals } from '../data/vitals';
import { byDateAsc, byDateDesc, formatDayTime, formatInstantDay } from '../data/portal-format';

/** How many rows a preview panel shows. */
const PREVIEW = 3;

interface Tile {
  readonly icon: IconName;
  /** Null when the figure is not known — see the class comment. */
  readonly value: number | null;
  readonly labelKey: string;
  readonly path: string;
}

/**
 * The first screen after sign-in: what is open, what is next, and how the patient is doing.
 *
 * **EVERY NUMBER ON THIS SCREEN IS A CLAIM.** §7.5's closing rule is that anything computed across
 * streams must decide explicitly what a failure means for it, and this screen is almost entirely
 * such numbers. A tile reading 0 because a request failed says "you have no open cases" — which is
 * the same lie whether it is cases, allergies or emergencies, and the patient has no way to tell it
 * from the truth. So every tile's value is `number | null`, and null renders as a dash, not a zero.
 */
@Component({
  selector: 'hpm-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    TranslateDirective,
    PortalPageComponent,
    StreamComponent,
    IconComponent,
    PanelComponent,
    TrendChartComponent,
    StatusLabelPipe,
  ],
  templateUrl: './overview.page.html',
  styleUrl: './overview.page.scss',
})
export class OverviewPage {
  private readonly context = inject(PatientContextService);
  private readonly data = inject(PortalDataService);
  private readonly translate = inject(TranslateService);
  private readonly portalNav = inject(PortalNavService);

  private readonly careTeamById = toSignal(this.context.careTeamById$, { initialValue: new Map<string, CareTeamMember>() });

  readonly profileState = toSignal(this.context.profileState$, { initialValue: LOADING as Resource<IProfile | null> });
  readonly casesState = toSignal(this.data.cases$, { initialValue: LOADING as Resource<readonly IClinicalCase[]> });
  readonly vitalsState = toSignal(this.data.vitals$, { initialValue: LOADING as Resource<readonly IStat[]> });
  readonly schedulesState = toSignal(this.data.schedules$, { initialValue: LOADING as Resource<readonly ITask[]> });
  readonly medicationsState = toSignal(this.data.medications$, { initialValue: LOADING as Resource<readonly IMedication[]> });
  readonly reportsState = toSignal(this.data.reports$, { initialValue: LOADING as Resource<readonly IReport[]> });
  readonly emergenciesState = toSignal(this.data.emergencies$, { initialValue: LOADING as Resource<readonly IEmergency[]> });
  readonly activityState = toSignal(this.data.activity$, { initialValue: LOADING as Resource<readonly IActivityLog[]> });
  readonly allergiesState = toSignal(this.data.allergies$, { initialValue: LOADING as Resource<readonly IAllergy[]> });
  readonly carePlanState = toSignal(this.data.carePlan$, { initialValue: LOADING as Resource<readonly ICarePlanItem[]> });

  readonly formatInstantDay = formatInstantDay;
  readonly formatDayTime = formatDayTime;

  readonly profile = computed(() => {
    const state = this.profileState();
    return state.state === 'loaded' ? state.value : null;
  });

  readonly greetingName = computed(() => this.profile()?.firstName ?? '');

  readonly vitals = computed(() => summariseVitals(rowsOf(this.vitalsState())));

  readonly openCases = computed(() => rowsOf(this.casesState()).filter(item => item.status !== 'CLOSED'));

  readonly tiles = computed<Tile[]>(() => [
    {
      icon: 'case',
      value: this.count(this.casesState(), rows => rows.filter(i => i.status !== 'CLOSED').length),
      labelKey: 'patientPortal.overview.tile.openCases',
      path: 'cases',
    },
    {
      icon: 'cal',
      value: isLoaded(this.schedulesState()) ? this.upcoming().length : null,
      labelKey: 'patientPortal.overview.tile.upcoming',
      path: 'schedules',
    },
    {
      icon: 'pill',
      value: this.count(this.medicationsState(), rows => rows.filter(m => m.status === 'ACTIVE').length),
      labelKey: 'patientPortal.overview.tile.medications',
      path: 'medications',
    },
    { icon: 'report', value: this.count(this.reportsState()), labelKey: 'patientPortal.overview.tile.reports', path: 'reports' },
  ]);

  readonly recordTiles = computed<Tile[]>(() => [
    {
      icon: 'alert',
      value: this.count(this.emergenciesState()),
      labelKey: 'patientPortal.overview.tile.emergencies',
      path: 'emergencies',
    },
    { icon: 'shield', value: this.count(this.allergiesState()), labelKey: 'patientPortal.overview.tile.allergies', path: 'allergies' },
    {
      icon: 'leaf',
      value: this.count(this.carePlanState(), rows => rows.filter(i => i.planType === 'DIET').length),
      labelKey: 'patientPortal.overview.tile.diet',
      path: 'plans',
    },
    {
      icon: 'run',
      value: this.count(this.carePlanState(), rows => rows.filter(i => i.planType === 'EXERCISE').length),
      labelKey: 'patientPortal.overview.tile.exercise',
      path: 'plans',
    },
  ]);

  /**
   * The emergencies badge. §7.5 names it directly: **nothing on loading or failed, never 0.**
   *
   * Zero emergencies is worth saying nothing about; an unknown number of emergencies is worth
   * saying nothing about too, and a confident "0" is the one thing it must never be.
   */
  readonly emergencyBadge = computed(() => {
    const count = this.count(this.emergenciesState());
    return count && count > 0 ? count : null;
  });

  /** Appointments still ahead of us, soonest first. */
  readonly upcoming = computed(() => {
    const now = Date.now();
    return rowsOf(this.schedulesState())
      .filter(task => task.status !== 'ATTENDED' && task.status !== 'CANCELLED')
      .filter(task => ((task.scheduledAt ?? task.schedule)?.valueOf() ?? 0) >= now)
      .sort(byDateAsc<ITask>(task => task.scheduledAt ?? task.schedule));
  });

  readonly nextAppointments = computed(() => this.upcoming().slice(0, PREVIEW));

  /**
   * The hero's sentence: the next appointment, and how much is still open.
   *
   * Null when there is nothing ahead — and null when the CASES stream is not loaded, because the
   * sentence reads "3 of your 12 cases are open" and a dropped connection would make that "0 of
   * your 0". A patient with no appointment gets the plain greeting rather than a sentence with a
   * gap in it; a patient with no data gets the same.
   */
  readonly heroSummary = computed(() => {
    const next = this.nextAppointments().at(0);
    if (!next || !isLoaded(this.casesState())) {
      return null;
    }
    return {
      when: formatDayTime(next.scheduledAt ?? next.schedule),
      clinician: PatientContextService.memberOf(this.careTeamById(), next.attendantId).name,
      open: this.openCases().length,
      total: rowsOf(this.casesState()).length,
    };
  });

  readonly recentActivity = computed(() =>
    [...rowsOf(this.activityState())].sort(byDateDesc<IActivityLog>(item => item.loggedAt ?? item.createdDate)).slice(0, PREVIEW),
  );

  readonly recentCases = computed(() =>
    [...rowsOf(this.casesState())].sort(byDateDesc<IClinicalCase>(item => item.openedAt)).slice(0, PREVIEW),
  );

  readonly selectedVital = signal<VitalSummary | null>(null);

  readonly currentVital = computed(() => this.selectedVital() ?? this.vitals().at(0) ?? null);

  go(path: string): void {
    void this.portalNav.go(path, 'overview');
  }

  openCase(caseId: string | null | undefined): void {
    if (caseId) {
      void this.portalNav.go(`case/${caseId}`, 'overview');
    }
  }

  memberOf(id: string | null | undefined): CareTeamMember {
    return PatientContextService.memberOf(this.careTeamById(), id);
  }

  authorName(item: { source?: string | null; authorId?: string | null }): string {
    return PatientContextService.authorNameOf(this.careTeamById(), item);
  }

  recorderOf(vital: VitalSummary): string {
    if (vital.source === 'PATIENT') {
      return this.translate.instant('patientPortal.overview.recordedByYou') as string;
    }
    return this.memberOf(vital.recordedById).name;
  }

  vitalPill(flag: string): string {
    switch (flag) {
      case 'DANGER':
        return 'hc-pill--danger';
      case 'WARN':
        return 'hc-pill--warn';
      default:
        return 'hc-pill--ok';
    }
  }

  /** Counted only when its own stream loaded. `null` otherwise — never a zero we cannot stand behind. */
  private count<T>(state: Resource<readonly T[]>, of?: (rows: readonly T[]) => number): number | null {
    if (!isLoaded(state)) {
      return null;
    }
    return of ? of(state.value) : state.value.length;
  }
}
