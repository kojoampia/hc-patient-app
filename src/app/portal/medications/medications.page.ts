/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/medications/medications.component.ts @ 12e418c
 * Divergence: Resource<T> streams (§7.5) — and `counts` is now null rather than three zeroes while
 *   loading or failed, see its comment; the web's ModalComponent becomes an `ion-modal`; the
 *   six-column table becomes a card list; the pager is dropped.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonButton, IonModal } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { IClinicalCase } from 'app/entities/patientMS/clinical-case/clinical-case.model';
import { IMedication } from 'app/entities/patientMS/medication/medication.model';
import { IconComponent } from 'app/shared/ui/icon/icon.component';
import { PersonFilterComponent } from 'app/shared/ui/person-filter/person-filter.component';
import { SearchBoxComponent } from 'app/shared/ui/search-box/search-box.component';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { PortalNavService } from 'app/shell/portal-nav.service';

import { CareTeamMember, PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { StatusLabelPipe } from '../data/status-label.pipe';
import { LOADING, Resource, isLoaded, rowsOf } from '../data/resource';
import { byDateDesc, formatDay, matches } from '../data/portal-format';

/**
 * Everything the patient has been prescribed, current and past.
 *
 * WITHHELD entries are shown rather than hidden: "Amoxicillin — not given, penicillin allergy" is a
 * safety record, and dropping it from the list is how it gets prescribed again.
 */
@Component({
  selector: 'hpm-medications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    TranslateDirective,
    PortalPageComponent,
    StreamComponent,
    IconComponent,
    SearchBoxComponent,
    PersonFilterComponent,
    StatusLabelPipe,
    IonModal,
    IonButton,
  ],
  templateUrl: './medications.page.html',
  styleUrl: './medications.page.scss',
})
export class MedicationsPage {
  private readonly context = inject(PatientContextService);
  private readonly data = inject(PortalDataService);
  private readonly portalNav = inject(PortalNavService);

  private readonly careTeamById = toSignal(this.context.careTeamById$, { initialValue: new Map<string, CareTeamMember>() });
  private readonly careTeamState = toSignal(this.context.careTeamState$, {
    initialValue: LOADING as Resource<readonly CareTeamMember[]>,
  });
  private readonly casesById = toSignal(this.data.casesById$, {
    initialValue: LOADING as Resource<ReadonlyMap<string, IClinicalCase>>,
  });

  readonly medications = toSignal(this.data.medications$, { initialValue: LOADING as Resource<readonly IMedication[]> });

  readonly careTeam = computed(() => rowsOf(this.careTeamState()));
  readonly formatDay = formatDay;

  readonly statuses = ['ACTIVE', 'COMPLETED', 'WITHHELD'] as const;

  /**
   * The shape of the list before you read it. The WITHHELD row is why this exists — a withheld
   * prescription is a safety decision somebody made about this patient, and in a list of fourteen
   * it is one row like any other. Counting it puts it where the eye lands.
   *
   * `null` while loading or failed (§7.5). Three confident zeroes produced by a dropped connection
   * would say "nothing withheld", which is exactly the claim this row exists to make impossible to
   * miss when it is not true.
   */
  readonly counts = computed(() => {
    const state = this.medications();
    if (!isLoaded(state)) {
      return null;
    }
    const all = state.value;
    return [
      {
        status: 'ACTIVE' as const,
        value: all.filter(i => i.status === 'ACTIVE').length,
        labelKey: 'patientPortal.medications.count.active',
      },
      {
        status: 'COMPLETED' as const,
        value: all.filter(i => i.status === 'COMPLETED').length,
        labelKey: 'patientPortal.medications.count.completed',
      },
      {
        status: 'WITHHELD' as const,
        value: all.filter(i => i.status === 'WITHHELD').length,
        labelKey: 'patientPortal.medications.count.withheld',
      },
    ];
  });

  /**
   * The medicine whose detail view is open, or null. What the detail adds is the *reason* — a
   * WITHHELD entry explains that it was not given because of the allergy on the record.
   */
  readonly selected = signal<IMedication | null>(null);

  readonly query = signal('');
  readonly status = signal<string | null>(null);
  readonly professional = signal<string | null>(null);

  readonly filtered = computed(() => {
    const status = this.status();
    const person = this.professional();
    return rowsOf(this.medications())
      .filter(item => !status || item.status === status)
      .filter(item => !person || item.prescribedById === person)
      .filter(item => matches(this.query(), item.name, item.dosage, item.prescription, item.description))
      .sort(byDateDesc(item => item.startedOn ?? item.createdDate));
  });

  open(item: IMedication): void {
    this.selected.set(item);
  }

  setStatus(value: string): void {
    this.status.set(this.status() === value ? null : value);
  }

  memberOf(id: string | null | undefined): CareTeamMember {
    return PatientContextService.memberOf(this.careTeamById(), id);
  }

  caseLabel(caseId: string | null | undefined): string {
    const cases = this.casesById();
    const record = caseId && cases.state === 'loaded' ? cases.value.get(caseId) : undefined;
    return record ? record.title ?? record.brief ?? '' : '';
  }

  openCase(caseId: string | null | undefined): void {
    if (caseId) {
      void this.portalNav.go(`case/${caseId}`, 'cases');
    }
  }

  pill(status: string | null | undefined): string {
    switch (status) {
      case 'ACTIVE':
        return 'hc-pill--ok';
      case 'WITHHELD':
        return 'hc-pill--danger';
      default:
        return 'hc-pill--grey';
    }
  }
}
