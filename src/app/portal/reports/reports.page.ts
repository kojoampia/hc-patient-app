/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/reports/reports.component.ts @ 12e418c
 * Divergence: Resource<T> streams (§7.5); ModalComponent -> ion-modal; table -> card list; pager
 *   dropped. And `openFile` diverges properly — see its comment: there are no tabs on a phone, so
 *   the web's open-a-tab-before-the-request popup-blocker dance has no meaning here.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonButton, IonModal, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { IClinicalCase } from 'app/entities/patientMS/clinical-case/clinical-case.model';
import { IReport } from 'app/entities/patientMS/report/report.model';
import { IconComponent } from 'app/shared/ui/icon/icon.component';
import { PersonFilterComponent } from 'app/shared/ui/person-filter/person-filter.component';
import { SearchBoxComponent } from 'app/shared/ui/search-box/search-box.component';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import TranslateDirective from 'app/shared/language/translate.directive';

import { CareTeamMember, PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { ACCEPTED_REPORT_TYPES, ReportUploadService } from '../data/report-upload.service';
import { LOADING, Resource, rowsOf } from '../data/resource';
import { byDateDesc, formatDay, matches } from '../data/portal-format';

/** Results and letters filed on the record, and the patient's own uploads. */
@Component({
  selector: 'hpm-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    TranslateDirective,
    PortalPageComponent,
    StreamComponent,
    IconComponent,
    SearchBoxComponent,
    PersonFilterComponent,
    IonModal,
    IonButton,
    IonSelect,
    IonSelectOption,
    IonSpinner,
  ],
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
})
export class ReportsPage {
  private readonly context = inject(PatientContextService);
  private readonly data = inject(PortalDataService);
  private readonly uploads = inject(ReportUploadService);

  private readonly patientIdState = toSignal(this.context.patientIdState$, { initialValue: LOADING as Resource<string | null> });
  private readonly careTeamById = toSignal(this.context.careTeamById$, { initialValue: new Map<string, CareTeamMember>() });
  private readonly careTeamState = toSignal(this.context.careTeamState$, {
    initialValue: LOADING as Resource<readonly CareTeamMember[]>,
  });
  private readonly casesById = toSignal(this.data.casesById$, {
    initialValue: LOADING as Resource<ReadonlyMap<string, IClinicalCase>>,
  });

  readonly reports = toSignal(this.data.reports$, { initialValue: LOADING as Resource<readonly IReport[]> });

  readonly careTeam = computed(() => rowsOf(this.careTeamState()));
  readonly formatDay = formatDay;

  /** What the file picker offers, and what the api will accept. */
  readonly acceptedTypes = ACCEPTED_REPORT_TYPES;

  readonly query = signal('');
  readonly category = signal<string | null>(null);
  readonly professional = signal<string | null>(null);

  /** The upload dialog and the file the patient picked. */
  readonly uploading = signal(false);
  readonly chosen = signal<File | null>(null);
  readonly fileName = signal('');
  readonly reportName = signal('');
  readonly uploadCase = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly saving = signal(false);

  /** The report whose file is being fetched, so its button can say so and not be pressed twice. */
  readonly opening = signal<string | null>(null);

  readonly filtered = computed(() => {
    const category = this.category();
    const person = this.professional();
    return rowsOf(this.reports())
      .filter(item => !category || item.category === category)
      .filter(item => !person || item.authorId === person)
      .filter(item => matches(this.query(), item.name, item.summary, item.description, item.category))
      .sort(byDateDesc(item => item.reportDate ?? item.createdDate));
  });

  /** The open cases a report can be filed against — a closed one is not what a new result belongs to. */
  readonly openCases = computed(() => {
    const cases = this.casesById();
    return cases.state === 'loaded' ? [...cases.value.values()].filter(item => item.status !== 'CLOSED') : [];
  });

  /** A report with no name and no file is not a report. */
  readonly canUpload = computed(() => this.reportName().trim().length > 0 && this.chosen() !== null && !this.saving());

  setCategory(value: string): void {
    this.category.set(this.category() === value ? null : value);
  }

  openUpload(): void {
    this.chosen.set(null);
    this.fileName.set('');
    this.reportName.set('');
    this.uploadCase.set(null);
    this.uploadError.set(null);
    this.uploading.set(true);
  }

  chooseFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.uploadError.set(null);
    if (file && this.uploads.reject(file) === 'size') {
      this.chosen.set(null);
      this.fileName.set('');
      this.uploadError.set('patientPortal.reports.tooLarge');
      return;
    }
    this.chosen.set(file);
    this.fileName.set(file?.name ?? '');
    // A patient who has not named it yet gets the filename as a starting point, minus the extension.
    if (file && !this.reportName().trim()) {
      this.reportName.set(file.name.replace(/\.[^.]+$/, ''));
    }
  }

  /**
   * Files the report, then re-reads the record. The file only exists once the api says so.
   */
  save(): void {
    const patientId = this.patientIdState();
    const file = this.chosen();
    if (!this.canUpload() || patientId.state !== 'loaded' || !patientId.value || !file) {
      return;
    }
    this.saving.set(true);
    this.uploadError.set(null);
    this.uploads.upload(patientId.value, { name: this.reportName().trim(), caseId: this.uploadCase(), summary: null }, file).subscribe({
      next: () => {
        this.saving.set(false);
        this.uploading.set(false);
        this.data.reload();
      },
      error: () => {
        this.saving.set(false);
        this.uploadError.set('patientPortal.reports.uploadFailed');
      },
    });
  }

  /**
   * Opens a report's file.
   *
   * **FETCHED, NEVER LINKED** — §8.4.1, and the web's own scar. The api wants a bearer token; a
   * plain navigation carries none, so `<a href>` produced a 401 error page for every uploaded file.
   * On this app it is worse than on the web: with `CapacitorHttp` enabled, a raw navigation or an
   * `<img src>` bypasses Angular's interceptor chain entirely — no Authorization AND no
   * X-Acting-As — so it could return a 200 carrying the wrong patient's file.
   *
   * The web's popup-blocker dance (open the tab inside the click, fill it in after) is dropped: a
   * webview has no tabs and no popup blocker. The blob is opened in place instead.
   *
   * KNOWN LIMIT, for phase 7: Android WebView renders images from a blob: URL but hands PDFs off
   * inconsistently. Doing this properly means writing to the filesystem and handing the file to a
   * native viewer — which needs plugins this phase does not add. Recorded rather than hidden.
   */
  openFile(item: IReport): void {
    if (!item.url || this.opening()) {
      return;
    }
    this.opening.set(item.id);
    this.uploads.open(item.url).subscribe({
      next: url => {
        this.opening.set(null);
        window.open(url, '_blank');
        // Revoked once it has had a chance to load; holding it forever leaks the blob.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.opening.set(null),
    });
  }

  memberOf(id: string | null | undefined): CareTeamMember {
    return PatientContextService.memberOf(this.careTeamById(), id);
  }

  caseLabel(caseId: string | null | undefined): string {
    const cases = this.casesById();
    const record = caseId && cases.state === 'loaded' ? cases.value.get(caseId) : undefined;
    return record ? (record.title ?? record.brief ?? '') : '';
  }
}
