/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/case-detail/case-detail.component.ts @ 12e418c
 * Divergence: Resource<T> streams (§7.5) — which makes `missing` HONEST rather than merely careful,
 *   see its comment; the web's hand-rolled ModalComponent becomes an `ion-modal` (its
 *   shared/ui/modal is not lifted, Ionic owns overlays here); `print()` is dropped, being
 *   meaningless on a phone; and the panels are Ionic accordions, because six stacked panels at
 *   390px is a very long scroll before the timeline.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import dayjs from 'dayjs/esm';

import { ActivityLogService } from 'app/entities/patientMS/activity-log/service/activity-log.service';
import { IconComponent } from 'app/shared/ui/icon/icon.component';
import { AvatarComponent } from 'app/shared/ui/avatar/avatar.component';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import { PortalNavService } from 'app/shell/portal-nav.service';

import { CareTeamMember, PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { StatusLabelPipe } from '../data/status-label.pipe';
import { LOADING, Resource, isLoaded, rowsOf } from '../data/resource';
import { byDateDesc, formatDay, formatInstantDay, humanise } from '../data/portal-format';

/**
 * One case in full: what was reported, what was found, what was recommended, and everything filed
 * against it — visits, medications, reports and timeline entries.
 */
@Component({
  selector: 'hpm-case-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslateModule,
    PortalPageComponent,
    StreamComponent,
    IconComponent,
    AvatarComponent,
    StatusLabelPipe,
    IonAccordionGroup,
    IonAccordion,
    IonItem,
    IonLabel,
    IonModal,
    IonButton,
    IonInput,
    IonTextarea,
    IonSpinner,
  ],
  templateUrl: './case-detail.page.html',
  styleUrl: './case-detail.page.scss',
})
export class CaseDetailPage {
  private readonly context = inject(PatientContextService);
  private readonly data = inject(PortalDataService);
  private readonly activityLogs = inject(ActivityLogService);
  private readonly portalNav = inject(PortalNavService);

  private readonly patientIdState = toSignal(this.context.patientIdState$, { initialValue: LOADING as Resource<string | null> });
  private readonly careTeamById = toSignal(this.context.careTeamById$, { initialValue: new Map<string, CareTeamMember>() });

  private readonly medications = toSignal(this.data.medications$, { initialValue: LOADING as Resource<readonly never[]> });
  private readonly reports = toSignal(this.data.reports$, { initialValue: LOADING as Resource<readonly never[]> });
  private readonly visitations = toSignal(this.data.visitations$, { initialValue: LOADING as Resource<readonly never[]> });
  private readonly activity = toSignal(this.data.activity$, { initialValue: LOADING as Resource<readonly never[]> });

  readonly cases = toSignal(this.data.cases$, { initialValue: LOADING as Resource<readonly never[]> });

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly id = input<string>('');

  readonly formatDay = formatDay;
  readonly formatInstantDay = formatInstantDay;

  /**
   * Where the header's back button goes — the root of whichever tab stack this case was opened on.
   *
   * §8.1 registers `case/:id` under all five tabs so that opening a case does not move the reader
   * out of the list they were scanning; the fixed `/tabs/cases` this template carried undid exactly
   * that. Read lazily, at first render: a case detail belongs to one stack for its whole life.
   */
  readonly backHref = computed(() => this.portalNav.currentTabRoot('cases'));

  /** Whether the "Log activity" dialog is up. */
  readonly logging = signal(false);

  /** The note being written, and what has become of it. */
  readonly noteTitle = signal('');
  readonly noteDetail = signal('');
  readonly saving = signal(false);
  readonly saveFailed = signal(false);

  readonly item = computed(() => rowsOf(this.cases()).find(entry => entry.id === this.id()) ?? null);

  /**
   * "Not found" is a CLAIM, and this is where Resource<T> earns its keep.
   *
   * The web guards with `cases().length > 0`, which is careful but not sufficient: a patient whose
   * case list genuinely loaded empty, and a patient whose case list failed to load, both produce
   * length 0 — so a dropped connection renders "Case not found. It may have been closed", which is
   * a statement about their medical record that nobody has any basis for. Requiring `isLoaded`
   * makes the claim honest; the failed branch renders the retry instead.
   */
  readonly missing = computed(() => isLoaded(this.cases()) && !this.item());

  readonly clinician = computed(() => PatientContextService.memberOf(this.careTeamById(), this.item()?.assignedProfessionalId));

  readonly recommendations = computed(() => this.item()?.recommendations ?? []);

  readonly caseMedications = computed(() =>
    rowsOf(this.medications())
      .filter(entry => entry.caseId === this.id())
      .sort(byDateDesc(entry => entry.startedOn ?? entry.createdDate)),
  );

  readonly caseReports = computed(() =>
    rowsOf(this.reports())
      .filter(entry => entry.caseId === this.id())
      .sort(byDateDesc(entry => entry.reportDate ?? entry.createdDate)),
  );

  readonly caseVisits = computed(() =>
    rowsOf(this.visitations())
      .filter(entry => entry.caseId === this.id())
      .sort(byDateDesc(entry => entry.visitedAt)),
  );

  readonly caseActivity = computed(() =>
    rowsOf(this.activity())
      .filter(entry => entry.caseId === this.id())
      .sort(byDateDesc(entry => entry.loggedAt ?? entry.createdDate)),
  );

  /** A note with no title is not a record of anything, so Save stays closed until there is one. */
  readonly canSave = computed(() => this.noteTitle().trim().length > 0 && !this.saving());

  openLog(): void {
    this.noteTitle.set('');
    this.noteDetail.set('');
    this.saveFailed.set(false);
    this.logging.set(true);
  }

  /**
   * Files the patient's own note against this case.
   *
   * `source: PATIENT` is what makes the trail credit it to "You" rather than to the care team — and
   * note that the field is set HERE only because this is a create. §4 and the api's own rule are
   * that `source` is stamped from the authenticated caller and a value a client can choose is a
   * claim rather than a record; the server is free to ignore this and does.
   *
   * The whole portal's data is reloaded rather than the entry pushed into a local list: the record
   * is the server's, and a note that only exists in this tab until a refresh is a note the patient
   * cannot trust.
   */
  save(): void {
    const patientId = this.patientIdState();
    if (!this.canSave() || patientId.state !== 'loaded' || !patientId.value) {
      return;
    }
    this.saving.set(true);
    this.saveFailed.set(false);
    this.activityLogs
      .create({
        id: null,
        patientId: patientId.value,
        caseId: this.id(),
        summary: this.noteTitle().trim(),
        detail: this.noteDetail().trim() || null,
        kind: 'NOTE',
        source: 'PATIENT',
        loggedAt: dayjs(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.logging.set(false);
          this.data.reload();
        },
        error: () => {
          this.saving.set(false);
          this.saveFailed.set(true);
        },
      });
  }

  /** The case as plain text, for pasting into a message to somebody who is not on the portal. */
  copy(): void {
    const record = this.item();
    if (!record) {
      return;
    }
    const lines = [
      `${record.title ?? record.brief ?? ''}`,
      `${formatInstantDay(record.openedAt)} · ${this.clinician().name} · ${humanise(record.status)}`,
      '',
      `${record.symptoms ?? ''}`,
      `${record.diagnosis ?? ''}`,
    ];
    void navigator.clipboard.writeText(lines.join('\n').trim());
  }

  memberOf(id: string | null | undefined): CareTeamMember {
    return PatientContextService.memberOf(this.careTeamById(), id);
  }

  /** Who wrote a timeline entry — the patient themselves, the system, or a clinician. */
  authorName(entry: { source?: string | null; authorId?: string | null }): string {
    return PatientContextService.authorNameOf(this.careTeamById(), entry);
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
