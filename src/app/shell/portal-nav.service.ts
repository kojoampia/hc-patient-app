/**
 * New in hc-patient-app — no origin in the web repo, which has no tab stacks to resolve against.
 *
 * **No template hardcodes a `/tabs/...` URL** (patient-mobile.md §8.1). Everything navigates through
 * `go('medications')`, which this resolves to `/tabs/cases/medications` by reading `TAB_OWNER`.
 * Moving a screen between tabs is then a one-line change to that map instead of a search for string
 * literals across thirteen screens — and a missed literal would not fail to build, it would just
 * navigate somewhere plausible and wrong.
 */

import { Injectable, inject } from '@angular/core';
import { NavController } from '@ionic/angular';

import { TAB_OWNER, tabOwnerOf } from './mobile-nav';

@Injectable({ providedIn: 'root' })
export class PortalNavService {
  private readonly nav = inject(NavController);

  /** The absolute route for a portal path, e.g. `medications` -> `/tabs/cases/medications`. */
  urlFor(path: string, fromTab?: string): string {
    const clean = path.replace(/^\/+/, '');
    const head: string | undefined = clean.split('/')[0];
    const tab: string = (head ? TAB_OWNER[head] : undefined) ?? fromTab ?? tabOwnerOf(clean);

    // A tab root addresses itself; `/tabs/cases/cases` would be a second history entry for the
    // screen the user is already on.
    return tab === clean ? `/tabs/${tab}` : `/tabs/${tab}/${clean}`;
  }

  /**
   * Navigate forward within the owning tab's stack.
   *
   * `navigateForward` rather than `navigateRoot`, so the back gesture returns to the list the reader
   * came from — the thing §6 decision 1 says a Capacitor wrapper would not have given us.
   */
  go(path: string, fromTab?: string): Promise<boolean> {
    return this.nav.navigateForward(this.urlFor(path, fromTab));
  }

  /** Switch tabs without stacking history — what a tab bar button does. */
  goRoot(path: string): Promise<boolean> {
    return this.nav.navigateRoot(this.urlFor(path));
  }
}
