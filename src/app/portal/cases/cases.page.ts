/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/cases/cases.component.ts @ 12e418c
 * Divergence: Resource<T> streams (§7.5); careTeam comes from careTeamState$ so the person filter is
 *   empty rather than wrong while it loads; the six-column table becomes a tappable card list; the
 *   pager is dropped (a phone scrolls); and the row link goes through PortalNavService so a case
 *   opens on the Cases stack rather than jumping tabs.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonAccordion, IonAccordionGroup, IonItem, IonLabel } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { IClinicalCase } from 'app/entities/patientMS/clinical-case/clinical-case.model';
import { IconComponent } from 'app/shared/ui/icon/icon.component';
import { PersonFilterComponent } from 'app/shared/ui/person-filter/person-filter.component';
import { SearchBoxComponent } from 'app/shared/ui/search-box/search-box.component';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import { PortalNavService } from 'app/shell/portal-nav.service';

import { CareTeamMember, PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { StatusLabelPipe } from '../data/status-label.pipe';
import { LOADING, Resource, rowsOf } from '../data/resource';
import { byDateDesc, formatInstantDay, matches } from '../data/portal-format';

/** The case list, filterable by status, clinician and free text. */
@Component({
  selector: 'hpm-cases',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    PortalPageComponent,
    StreamComponent,
    IconComponent,
    SearchBoxComponent,
    PersonFilterComponent,
    StatusLabelPipe,
    IonAccordion,
    IonAccordionGroup,
    IonItem,
    IonLabel,
  ],
  templateUrl: './cases.page.html',
  styleUrl: './cases.page.scss',
})
export class CasesPage {
  private readonly context = inject(PatientContextService);
  private readonly data = inject(PortalDataService);
  private readonly portalNav = inject(PortalNavService);

  private readonly careTeamById = toSignal(this.context.careTeamById$, { initialValue: new Map<string, CareTeamMember>() });
  private readonly careTeamState = toSignal(this.context.careTeamState$, {
    initialValue: LOADING as Resource<readonly CareTeamMember[]>,
  });

  readonly cases = toSignal(this.data.cases$, { initialValue: LOADING as Resource<readonly IClinicalCase[]> });

  /**
   * Cases a professional retired, newest first.
   *
   * Kept out of the list above rather than filtered into it: the working list answers "what is
   * happening to me", and an archived case does not. Shown at all because the api excluding them by
   * default is right for a clinician's queue and wrong for a patient's own history.
   *
   * Read through `value` rather than `hpm-stream`: this section only renders once the list above has
   * loaded, so a second loading state under a loaded one would be noise, and a failure here is
   * already visible as the failure of the same request.
   */
  readonly archived = toSignal(this.data.archivedCases$, { initialValue: LOADING as Resource<readonly IClinicalCase[]> });

  /** The archived rows, or none while the fetch is loading or failed. */
  readonly archivedRows = computed<readonly IClinicalCase[]>(() => {
    const state = this.archived();
    return state.state === 'loaded' ? state.value : [];
  });

  /**
   * The people who can be filtered by. Empty while the care team is loading or failed — offering a
   * filter that cannot resolve names would let somebody filter to a clinician labelled by their id.
   */
  readonly careTeam = computed(() => rowsOf(this.careTeamState()));

  readonly formatInstantDay = formatInstantDay;

  readonly statuses = ['URGENT', 'OPEN', 'TREATMENT', 'CLOSED'] as const;

  readonly query = signal('');
  readonly status = signal<string | null>(null);
  /** Whose records to show — null is everyone. */
  readonly professional = signal<string | null>(null);

  readonly filtered = computed(() => {
    const status = this.status();
    const person = this.professional();
    return rowsOf(this.cases())
      .filter(item => !status || item.status === status)
      .filter(item => !person || item.assignedProfessionalId === person)
      .filter(item => matches(this.query(), item.title, item.brief, item.diagnosis, item.symptoms, item.caseNumber))
      .sort(byDateDesc(item => item.openedAt));
  });

  setStatus(value: string | null): void {
    this.status.set(this.status() === value ? null : value);
  }

  memberOf(id: string | null | undefined): CareTeamMember {
    return PatientContextService.memberOf(this.careTeamById(), id);
  }

  open(id: string | undefined): void {
    if (id) {
      void this.portalNav.go(`case/${id}`, 'cases');
    }
  }

  pill(status: string | null | undefined): string {
    switch (status) {
      case 'URGENT':
        return 'hc-pill--danger';
      case 'OPEN':
        return 'hc-pill--warn';
      case 'TREATMENT':
        return 'hc-pill--navy';
      default:
        return 'hc-pill--grey';
    }
  }
}
