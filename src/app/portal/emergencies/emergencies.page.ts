/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/emergencies/emergencies.component.ts @ 12e418c
 * Divergence: the streams carry Resource<T> now (§7.5), so `toSignal` starts at LOADING rather than
 *   [] and the rows come through `rowsOf`; the Resource itself goes to `hpm-stream`. The case link
 *   goes through PortalNavService instead of a routerLink, because case/:id is registered under all
 *   five tabs and must open on the stack the reader is already on. Template rewritten for Ionic.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { IClinicalCase } from 'app/entities/patientMS/clinical-case/clinical-case.model';
import { IEmergency } from 'app/entities/patientMS/emergency/emergency.model';
import { IconComponent } from 'app/shared/ui/icon/icon.component';
import { SearchBoxComponent } from 'app/shared/ui/search-box/search-box.component';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { PortalNavService } from 'app/shell/portal-nav.service';

import { CareTeamMember, PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { StatusLabelPipe } from '../data/status-label.pipe';
import { LOADING, Resource, rowsOf } from '../data/resource';
import { byDateDesc, formatDayTime, matches } from '../data/portal-format';

/** Every emergency raised on this record, newest first, with what came of it. */
@Component({
  selector: 'hpm-emergencies',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, PortalPageComponent, StreamComponent, IconComponent, SearchBoxComponent, StatusLabelPipe],
  templateUrl: './emergencies.page.html',
  styleUrl: './emergencies.page.scss',
})
export class EmergenciesPage {
  private readonly context = inject(PatientContextService);
  private readonly data = inject(PortalDataService);
  private readonly portalNav = inject(PortalNavService);

  private readonly careTeamById = toSignal(this.context.careTeamById$, { initialValue: new Map<string, CareTeamMember>() });
  private readonly casesById = toSignal(this.data.casesById$, {
    initialValue: LOADING as Resource<ReadonlyMap<string, IClinicalCase>>,
  });

  /** Handed to hpm-stream as-is. The screen must not collapse it. */
  readonly emergencies = toSignal(this.data.emergencies$, { initialValue: LOADING as Resource<readonly IEmergency[]> });

  readonly formatDayTime = formatDayTime;

  readonly query = signal('');

  readonly filtered = computed(() =>
    rowsOf(this.emergencies())
      .filter(item => matches(this.query(), item.brief, item.detail, item.outcome, item.location))
      .sort(byDateDesc(item => item.raisedAt)),
  );

  memberOf(id: string | null | undefined): CareTeamMember {
    return PatientContextService.memberOf(this.careTeamById(), id);
  }

  caseLabel(caseId: string | null | undefined): string {
    const cases = this.casesById();
    const record = caseId && cases.state === 'loaded' ? cases.value.get(caseId) : undefined;
    return record ? (record.title ?? record.brief ?? '') : '';
  }

  /** Opens on THIS tab's stack — see the class comment. */
  openCase(caseId: string | null | undefined): void {
    if (caseId) {
      void this.portalNav.go(`case/${caseId}`, 'overview');
    }
  }

  severityPill(severity: string | null | undefined): string {
    switch (severity) {
      case 'HIGH':
        return 'hc-pill--danger';
      case 'MODERATE':
        return 'hc-pill--warn';
      default:
        return 'hc-pill--grey';
    }
  }

  statusPill(status: string | null | undefined): string {
    return status === 'RESOLVED' ? 'hc-pill--ok' : 'hc-pill--warn';
  }
}
