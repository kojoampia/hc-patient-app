/**
 * New in hc-patient-app — no origin in the web repo, which has a sidebar and so never had this
 * problem.
 *
 * **FIVE TABS CANNOT REACH TEN DESTINATIONS** (patient-mobile.md §8.1). Every tab root carries a
 * `⋯` opening this sheet, which lists all ten MOBILE_NAV items with their icons and group headings,
 * driven off the same constant the tab bar reads.
 *
 * This is the sidebar's job on a phone, and it is what stops a repeat of the web defect where two
 * screens — `visitations` and `activity` — sat routed with no way into them for months.
 */

import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { PortalNavService } from './portal-nav.service';
import { MOBILE_NAV, MobileNavItem } from './mobile-nav';

interface NavGroup {
  readonly groupKey: string;
  readonly items: readonly MobileNavItem[];
}

@Component({
  selector: 'hpm-more-sheet',
  templateUrl: './more-sheet.component.html',
  styleUrl: './more-sheet.component.scss',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonLabel, IonIcon, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoreSheetComponent {
  private readonly portalNav = inject(PortalNavService);

  readonly closed = output<void>();

  /**
   * Grouped by `groupKey`, emitting a heading whenever it changes — so the ORDER OF THE ARRAY is the
   * order on screen, exactly as the web's sidebar works. Regrouping means reordering MOBILE_NAV,
   * not editing this.
   */
  readonly groups = computed<NavGroup[]>(() => {
    const groups: NavGroup[] = [];
    for (const item of MOBILE_NAV) {
      const last: NavGroup | undefined = groups.length > 0 ? groups[groups.length - 1] : undefined;
      if (last && last.groupKey === item.groupKey) {
        (last.items as MobileNavItem[]).push(item);
      } else {
        groups.push({ groupKey: item.groupKey, items: [item] });
      }
    }
    return groups;
  });

  async go(item: MobileNavItem): Promise<void> {
    this.closed.emit();
    await this.portalNav.go(item.path);
  }
}
