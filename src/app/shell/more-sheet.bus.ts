/**
 * New in hc-patient-app.
 *
 * The ⋯ button lives on each screen's toolbar; the sheet it opens is owned by the shell, above
 * `ion-tabs`. The screens are rendered by the tab router outlet and cannot bind to TabsPage, so the
 * request travels through here.
 *
 * Deliberately tiny and deliberately one-way: screens ASK for the sheet, they do not own it. The
 * sheet has to stay in the shell for the same reason the banner does (§7.4) — it lists all ten
 * destinations, and a per-page copy would be ten chances to fall out of step with MOBILE_NAV.
 */

import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MoreSheetBus {
  private readonly requests = new Subject<void>();

  readonly opened$ = this.requests.asObservable();

  open(): void {
    this.requests.next();
  }
}
