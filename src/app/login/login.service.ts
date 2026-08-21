/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/login/login.service.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { Account } from 'app/core/auth/account.model';
import { AccountService } from 'app/core/auth/account.service';
import { ActingAsService } from 'app/core/auth/acting-as.service';
import { AuthServerProvider } from 'app/core/auth/auth-jwt.service';
import { Login } from './login.model';

@Injectable({ providedIn: 'root' })
export class LoginService {
  constructor(
    private accountService: AccountService,
    private authServerProvider: AuthServerProvider,
    private actingAsService: ActingAsService,
  ) {}

  /**
   * Cleared on the way in as well as the way out. Signing in is by definition a new person at this browser, and the
   * selection is about whose medical record is on screen — inheriting the last one is the failure this guards.
   */
  login(credentials: Login): Observable<Account | null> {
    this.actingAsService.clear();
    return this.authServerProvider.login(credentials).pipe(mergeMap(() => this.accountService.identity(true)));
  }

  /**
   * <b>Clearing here, rather than in the component that offers the menu item, is deliberate:</b> this is the one
   * path all three callers share, and one of them is `AuthExpiredInterceptor` — a session that expires is exactly
   * when nobody is thinking about the acting-as selection. It used to be cleared nowhere at all, so a care angel's
   * choice survived into the next person's session at the same browser, and because `setAvailable` accepts a
   * remembered id that is still valid it was applied silently, with no picker and no announcement.
   */
  logout(): void {
    this.actingAsService.clear();
    this.authServerProvider.logout().subscribe({ complete: () => this.accountService.authenticate(null) });
  }
}
