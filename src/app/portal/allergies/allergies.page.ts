/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/allergies/allergies.component.ts @ 12e418c
 * Divergence: Resource<T> streams (§7.5), and `allergyCount` is null rather than 0 while loading or
 *   failed — on THIS screen that guard matters more than anywhere else in the app; see its comment.
 *   Template rewritten for Ionic; the two-column grid collapses to one.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { IAllergy } from 'app/entities/patientMS/allergy/allergy.model';
import { ICondition } from 'app/entities/patientMS/condition/condition.model';
import { IMedication } from 'app/entities/patientMS/medication/medication.model';
import { IconComponent } from 'app/shared/ui/icon/icon.component';
import { PanelComponent } from 'app/shared/ui/panel/panel.component';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import TranslateDirective from 'app/shared/language/translate.directive';

import { CareTeamMember, PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { StatusLabelPipe } from '../data/status-label.pipe';
import { LOADING, Resource, isLoaded, rowsOf } from '../data/resource';
import { byDateDesc, formatDay } from '../data/portal-format';

/** Order of severity, worst first — this is a safety list, not an alphabetical one. */
const SEVERITY_RANK: Readonly<Record<string, number | undefined>> = { SEVERE: 0, MODERATE: 1, MILD: 2 };

/**
 * Allergies and long-standing conditions.
 *
 * Deliberately unpaginated and unfiltered: this is the screen someone opens in a hurry to check
 * whether a drug is safe, and a hidden row is a clinical risk. It is also why it lives under the
 * Record tab (§8.1) — no other screen links to it, so without an explicit home it would have none.
 */
@Component({
  selector: 'hpm-allergies',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, TranslateDirective, PortalPageComponent, StreamComponent, IconComponent, PanelComponent, StatusLabelPipe],
  templateUrl: './allergies.page.html',
  styleUrl: './allergies.page.scss',
})
export class AllergiesPage {
  private readonly context = inject(PatientContextService);
  private readonly data = inject(PortalDataService);

  private readonly careTeamById = toSignal(this.context.careTeamById$, { initialValue: new Map<string, CareTeamMember>() });
  private readonly medications = toSignal(this.data.medications$, { initialValue: LOADING as Resource<readonly IMedication[]> });

  readonly allergiesState = toSignal(this.data.allergies$, { initialValue: LOADING as Resource<readonly IAllergy[]> });
  readonly conditionsState = toSignal(this.data.conditions$, { initialValue: LOADING as Resource<readonly ICondition[]> });

  readonly formatDay = formatDay;

  readonly allergies = computed(() =>
    [...rowsOf(this.allergiesState())].sort((a, b) => (SEVERITY_RANK[a.severity ?? ''] ?? 3) - (SEVERITY_RANK[b.severity ?? ''] ?? 3)),
  );

  readonly conditions = computed(() => rowsOf(this.conditionsState()));

  /**
   * THE MOST IMPORTANT NULL IN THE APP.
   *
   * The banner reads "{{count}} allergies on record", and the web computes it from an array that is
   * empty on failure exactly as it is empty when the patient genuinely has none. So a dropped
   * connection renders **"0 allergies on record"** above the words "prescribing is blocked against
   * this" — on the one screen a clinician or a patient opens to decide whether a drug is safe.
   *
   * Null while loading or failed. The banner is not rendered at all, and hpm-stream shows why.
   */
  readonly allergyCount = computed(() => (isLoaded(this.allergiesState()) ? this.allergies().length : null));

  /**
   * Prescriptions withheld because of something on this page.
   *
   * The row itself already exists on Medications, where it reads as one line in a list of fourteen.
   * Here it is the evidence for the sentence above it: the allergy record is not a note, it stopped
   * a specific drug on a specific day.
   */
  readonly blocked = computed(() =>
    rowsOf(this.medications())
      .filter(item => item.status === 'WITHHELD')
      // Explicit type argument: byDateDesc cannot infer it from a bare arrow in this position.
      .sort(byDateDesc<IMedication>(item => item.startedOn)),
  );

  memberOf(id: string | null | undefined): CareTeamMember {
    return PatientContextService.memberOf(this.careTeamById(), id);
  }

  pill(severity: string | null | undefined): string {
    switch (severity) {
      case 'SEVERE':
        return 'hc-pill--danger';
      case 'MODERATE':
        return 'hc-pill--warn';
      default:
        return 'hc-pill--grey';
    }
  }
}
