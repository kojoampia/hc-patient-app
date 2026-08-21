/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/schedules/schedules.component.ts @ 12e418c
 * Divergence: Resource<T> streams (§7.5); ModalComponent -> ion-modal; the attended table becomes a
 *   card list; upcoming/past become an ion-segment rather than two stacked sections, because on a
 *   phone the next appointment should be the first thing on screen and not below a past one.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonButton, IonModal, IonSegment, IonSegmentButton, IonLabel } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { IClinicalCase } from 'app/entities/patientMS/clinical-case/clinical-case.model';
import { ITask } from 'app/entities/patientMS/task/task.model';
import { AvatarComponent } from 'app/shared/ui/avatar/avatar.component';
import { PersonFilterComponent } from 'app/shared/ui/person-filter/person-filter.component';
import { SearchBoxComponent } from 'app/shared/ui/search-box/search-box.component';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import TranslateDirective from 'app/shared/language/translate.directive';

import { CareTeamMember, PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { StatusLabelPipe } from '../data/status-label.pipe';
import { LOADING, Resource, rowsOf } from '../data/resource';
import { byDateAsc, byDateDesc, formatDay, formatInstantDay, formatTime, matches } from '../data/portal-format';

/**
 * Appointments, split into what is still coming and what already happened.
 *
 * Upcoming reads soonest-first because the next one is the one that matters; past reads newest-first
 * for the same reason in reverse.
 */
@Component({
  selector: 'hpm-schedules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    TranslateDirective,
    PortalPageComponent,
    StreamComponent,
    AvatarComponent,
    SearchBoxComponent,
    PersonFilterComponent,
    StatusLabelPipe,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonModal,
    IonButton,
  ],
  templateUrl: './schedules.page.html',
  styleUrl: './schedules.page.scss',
})
export class SchedulesPage {
  private readonly context = inject(PatientContextService);
  private readonly data = inject(PortalDataService);

  private readonly careTeamById = toSignal(this.context.careTeamById$, { initialValue: new Map<string, CareTeamMember>() });
  private readonly careTeamState = toSignal(this.context.careTeamState$, {
    initialValue: LOADING as Resource<readonly CareTeamMember[]>,
  });
  private readonly casesById = toSignal(this.data.casesById$, {
    initialValue: LOADING as Resource<ReadonlyMap<string, IClinicalCase>>,
  });

  private readonly matching = computed(() => {
    const person = this.professional();
    return rowsOf(this.schedules())
      .filter(item => !person || item.attendantId === person)
      .filter(item =>
        // The formatted date is included so "28 Jul" finds an appointment, which is how a person
        // searches a schedule — the raw instant would never match what they typed.
        matches(
          this.query(),
          item.name,
          item.description,
          item.location,
          item.attendant,
          formatInstantDay(item.scheduledAt, item.schedule),
        ),
      );
  });

  readonly schedules = toSignal(this.data.schedules$, { initialValue: LOADING as Resource<readonly ITask[]> });

  readonly careTeam = computed(() => rowsOf(this.careTeamState()));

  readonly formatDay = formatDay;
  readonly formatInstantDay = formatInstantDay;
  readonly formatTime = formatTime;

  readonly query = signal('');
  readonly professional = signal<string | null>(null);
  readonly tab = signal<'upcoming' | 'past'>('upcoming');

  /** The appointment whose detail view is open, or null. */
  readonly selected = signal<ITask | null>(null);

  /** Not yet attended and not cancelled, regardless of date — a missed appointment still needs action. */
  readonly upcoming = computed(() =>
    this.matching()
      .filter(item => item.status !== 'ATTENDED' && item.status !== 'CANCELLED')
      .sort(byDateAsc(item => item.scheduledAt ?? item.schedule)),
  );

  readonly past = computed(() =>
    this.matching()
      .filter(item => item.status === 'ATTENDED' || item.status === 'CANCELLED')
      .sort(byDateDesc(item => item.scheduledAt ?? item.schedule)),
  );

  readonly visible = computed(() => (this.tab() === 'upcoming' ? this.upcoming() : this.past()));

  memberOf(id: string | null | undefined): CareTeamMember {
    return PatientContextService.memberOf(this.careTeamById(), id);
  }

  caseLabel(caseId: string | null | undefined): string {
    const cases = this.casesById();
    const record = caseId && cases.state === 'loaded' ? cases.value.get(caseId) : undefined;
    return record ? (record.title ?? record.brief ?? '') : '';
  }

  pill(status: string | null | undefined): string {
    switch (status) {
      case 'CONFIRMED':
        return 'hc-pill--ok';
      case 'PENDING':
        return 'hc-pill--warn';
      case 'CANCELLED':
        return 'hc-pill--danger';
      default:
        return 'hc-pill--grey';
    }
  }
}
