/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/activity/activity.component.ts @ 12e418c
 * Divergence: Resource<T> streams (§7.5); case link through PortalNavService; the pager is dropped
 *   (a phone scrolls) and the kind filter becomes a horizontally scrolling chip row rather than a
 *   wrapped button block, which at 390px would occupy most of the screen before the timeline began.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { IActivityLog } from 'app/entities/patientMS/activity-log/activity-log.model';
import { IClinicalCase } from 'app/entities/patientMS/clinical-case/clinical-case.model';
import { IconComponent } from 'app/shared/ui/icon/icon.component';
import { IconName } from 'app/shared/ui/icon/icon.constants';
import { SearchBoxComponent } from 'app/shared/ui/search-box/search-box.component';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import { PortalNavService } from 'app/shell/portal-nav.service';

import { CareTeamMember, PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { StatusLabelPipe } from '../data/status-label.pipe';
import { LOADING, Resource, rowsOf } from '../data/resource';
import { byDateDesc, formatInstantDay, matches } from '../data/portal-format';

/** Icon and dot colour per kind of timeline entry. */
const KIND_STYLE: Readonly<Record<string, { icon: IconName; colour: string } | undefined>> = {
  CASE: { icon: 'case', colour: 'var(--hc-navy)' },
  VITAL: { icon: 'heart', colour: 'var(--hc-ok)' },
  RECOMMENDATION: { icon: 'check', colour: 'var(--hc-gold)' },
  REPORT: { icon: 'report', colour: 'var(--hc-navy-700)' },
  VISIT: { icon: 'pin', colour: 'var(--hc-ok)' },
  MEDICATION: { icon: 'pill', colour: 'var(--hc-gold)' },
  NOTE: { icon: 'note', colour: 'var(--hc-grey)' },
};

const DEFAULT_STYLE = { icon: 'note' as IconName, colour: 'var(--hc-grey)' };

/** The full record timeline: everything filed, by anyone, newest first. */
@Component({
  selector: 'hpm-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PortalPageComponent, StreamComponent, IconComponent, SearchBoxComponent, StatusLabelPipe],
  templateUrl: './activity.page.html',
  styleUrl: './activity.page.scss',
})
export class ActivityPage {
  private readonly context = inject(PatientContextService);
  private readonly data = inject(PortalDataService);
  private readonly portalNav = inject(PortalNavService);

  private readonly careTeamById = toSignal(this.context.careTeamById$, { initialValue: new Map<string, CareTeamMember>() });
  private readonly casesById = toSignal(this.data.casesById$, {
    initialValue: LOADING as Resource<ReadonlyMap<string, IClinicalCase>>,
  });

  readonly activity = toSignal(this.data.activity$, { initialValue: LOADING as Resource<readonly IActivityLog[]> });

  readonly formatInstantDay = formatInstantDay;

  readonly kinds = ['CASE', 'VITAL', 'RECOMMENDATION', 'REPORT', 'VISIT', 'MEDICATION', 'NOTE'] as const;

  readonly query = signal('');
  readonly kind = signal<string | null>(null);

  readonly filtered = computed(() => {
    const kind = this.kind();
    return rowsOf(this.activity())
      .filter(item => !kind || item.kind === kind)
      .filter(item => matches(this.query(), item.summary, item.detail))
      .sort(byDateDesc(item => item.loggedAt ?? item.createdDate));
  });

  setKind(value: string): void {
    this.kind.set(this.kind() === value ? null : value);
  }

  style(kind: string | null | undefined): { icon: IconName; colour: string } {
    return (kind ? KIND_STYLE[kind] : undefined) ?? DEFAULT_STYLE;
  }

  /** Entries the patient wrote themselves are attributed to them, not to a clinician. */
  authorName(item: { source?: string | null; authorId?: string | null }): string {
    return PatientContextService.authorNameOf(this.careTeamById(), item);
  }

  caseLabel(caseId: string | null | undefined): string {
    const cases = this.casesById();
    const record = caseId && cases.state === 'loaded' ? cases.value.get(caseId) : undefined;
    return record ? (record.title ?? record.brief ?? '') : '';
  }

  openCase(caseId: string | null | undefined): void {
    if (caseId) {
      void this.portalNav.go(`case/${caseId}`, 'record');
    }
  }
}
