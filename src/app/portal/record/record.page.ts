/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/record/record.component.ts @ 12e418c
 * Divergence: Resource<T> streams (§7.5); the five paginated panels become "the newest three, with
 *   a way into the full screen" — the web pages them because five panels side by side leave no
 *   route to the seventh row, but on a phone each panel already has its own screen one tap away, so
 *   a pager inside a panel is a control competing with the tab bar. `print()` is dropped.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, Signal, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonSkeletonText } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { IProfile } from 'app/entities/patientMS/profile/profile.model';
import { PanelComponent } from 'app/shared/ui/panel/panel.component';
import { TrendChartComponent } from 'app/shared/ui/charts/trend-chart.component';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { PortalNavService } from 'app/shell/portal-nav.service';

import { CareTeamMember, PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { StatusLabelPipe } from '../data/status-label.pipe';
import { LOADING, Resource, rowsOf } from '../data/resource';
import { VitalSummary, summariseVitals } from '../data/vitals';
import { byDateDesc, formatAddress, formatDay, formatInstantDay } from '../data/portal-format';

/** Rows a record panel previews before handing off to the full screen. */
const PANEL_ROWS = 3;

/** The newest few of a collection, sorted. */
function preview<T>(all: Signal<readonly T[]>): Signal<readonly T[]> {
  return computed(() => all().slice(0, PANEL_ROWS));
}

/**
 * The record: who the patient is, the vitals in detail, and every other list in reach.
 *
 * The selected vital drives the trend chart — one chart shown well beats four shown small.
 */
@Component({
  selector: 'hpm-record',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    TranslateDirective,
    PortalPageComponent,
    StreamComponent,
    PanelComponent,
    TrendChartComponent,
    StatusLabelPipe,
    IonSkeletonText,
  ],
  templateUrl: './record.page.html',
  styleUrl: './record.page.scss',
})
export class RecordPage {
  private readonly context = inject(PatientContextService);
  private readonly data = inject(PortalDataService);
  private readonly translate = inject(TranslateService);
  private readonly portalNav = inject(PortalNavService);

  private readonly careTeamById = toSignal(this.context.careTeamById$, { initialValue: new Map<string, CareTeamMember>() });

  readonly profileState = toSignal(this.context.profileState$, { initialValue: LOADING as Resource<IProfile | null> });
  readonly vitalsState = toSignal(this.data.vitals$, { initialValue: LOADING as Resource<readonly never[]> });
  readonly casesState = toSignal(this.data.cases$, { initialValue: LOADING as Resource<readonly never[]> });
  readonly visitationsState = toSignal(this.data.visitations$, { initialValue: LOADING as Resource<readonly never[]> });
  readonly activityState = toSignal(this.data.activity$, { initialValue: LOADING as Resource<readonly never[]> });
  readonly medicationsState = toSignal(this.data.medications$, { initialValue: LOADING as Resource<readonly never[]> });
  readonly reportsState = toSignal(this.data.reports$, { initialValue: LOADING as Resource<readonly never[]> });

  readonly formatDay = formatDay;
  readonly formatInstantDay = formatInstantDay;

  readonly profile = computed(() => {
    const state = this.profileState();
    return state.state === 'loaded' ? state.value : null;
  });

  /** Which vital the trend chart is showing; null means "the first one". */
  readonly selectedKey = signal<string | null>(null);

  /** Swaps the chart for the same numbers as a table. */
  readonly showTable = signal(false);

  readonly vitals = computed(() => summariseVitals(rowsOf(this.vitalsState())));

  readonly cases = preview(computed(() => [...rowsOf(this.casesState())].sort(byDateDesc(item => item.openedAt))));
  readonly visits = preview(computed(() => [...rowsOf(this.visitationsState())].sort(byDateDesc(item => item.visitedAt))));
  readonly activity = preview(
    computed(() => [...rowsOf(this.activityState())].sort(byDateDesc(item => item.loggedAt ?? item.createdDate))),
  );
  readonly medications = preview(
    computed(() => [...rowsOf(this.medicationsState())].sort(byDateDesc(item => item.startedOn ?? item.createdDate))),
  );
  readonly reports = preview(
    computed(() => [...rowsOf(this.reportsState())].sort(byDateDesc(item => item.reportDate ?? item.createdDate))),
  );

  readonly selected = computed<VitalSummary | null>(() => {
    const all = this.vitals();
    const key = this.selectedKey();
    return all.find(vital => vital.key === key) ?? all.at(0) ?? null;
  });

  readonly fullName = computed(() => {
    const profile = this.profile();
    if (!profile) {
      return '';
    }
    return [profile.firstName, profile.middleNames, profile.lastName].filter(Boolean).join(' ').trim();
  });

  /**
   * §8.4.2: `Profile.address` is a DOCUMENT, not a string. Interpolating it prints `[object
   * Object]`, and `formatAddress` is the only way to render it.
   */
  readonly address = computed(() => formatAddress(this.profile()?.address));

  memberOf(id: string | null | undefined): CareTeamMember {
    return PatientContextService.memberOf(this.careTeamById(), id);
  }

  /** Entries the patient wrote themselves are attributed to them, not to a clinician. */
  authorName(item: { source?: string | null; authorId?: string | null }): string {
    return PatientContextService.authorNameOf(this.careTeamById(), item);
  }

  go(path: string): void {
    void this.portalNav.go(path, 'record');
  }

  openCase(caseId: string | null | undefined): void {
    if (caseId) {
      void this.portalNav.go(`case/${caseId}`, 'record');
    }
  }

  /**
   * Who took the reading the chart is showing. A reading the patient took themselves is theirs, and
   * one the record does not attribute is the care team's rather than a name never written down.
   */
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
}
