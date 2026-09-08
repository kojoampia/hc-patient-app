/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/visitations/visitations.component.ts @ 12e418c
 * Divergence: Resource<T> streams (§7.5); the case link goes through PortalNavService so it opens
 *   on this tab's stack; and the template is a card list rather than the web's five-column
 *   `.hc-tbl`. A 5-column table at 390px scrolls sideways inside its wrapper and is unreadable —
 *   §7.2 rewrites every template for exactly this reason. The pager is dropped with it: the list is
 *   short and a phone scrolls.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { IClinicalCase } from 'app/entities/patientMS/clinical-case/clinical-case.model';
import { IVisitation } from 'app/entities/patientMS/visitation/visitation.model';
import { SearchBoxComponent } from 'app/shared/ui/search-box/search-box.component';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import TranslateDirective from 'app/shared/language/translate.directive';
import { PortalNavService } from 'app/shell/portal-nav.service';

import { CareTeamMember, PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { LOADING, Resource, rowsOf } from '../data/resource';
import { byDateDesc, formatInstantDay, matches } from '../data/portal-format';

/** Every visit that took place, newest first. */
@Component({
  selector: 'hpm-visitations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, PortalPageComponent, StreamComponent, SearchBoxComponent],
  templateUrl: './visitations.page.html',
})
export class VisitationsPage {
  private readonly context = inject(PatientContextService);
  private readonly data = inject(PortalDataService);
  private readonly portalNav = inject(PortalNavService);

  private readonly careTeamById = toSignal(this.context.careTeamById$, { initialValue: new Map<string, CareTeamMember>() });
  private readonly casesById = toSignal(this.data.casesById$, {
    initialValue: LOADING as Resource<ReadonlyMap<string, IClinicalCase>>,
  });

  readonly visitations = toSignal(this.data.visitations$, { initialValue: LOADING as Resource<readonly IVisitation[]> });

  readonly formatInstantDay = formatInstantDay;

  readonly query = signal('');

  readonly filtered = computed(() =>
    rowsOf(this.visitations())
      .filter(item => matches(this.query(), item.purpose, item.location, item.notes, formatInstantDay(item.visitedAt)))
      .sort(byDateDesc(item => item.visitedAt)),
  );

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
      void this.portalNav.go(`case/${caseId}`, 'record');
    }
  }
}
