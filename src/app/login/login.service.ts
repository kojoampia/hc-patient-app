/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/login/login.service.ts @ 12e418c
 * Divergence: `logout()` navigates, and finishes even when the request to the gateway fails.
 *   Both are consequences of there being no chrome around a phone screen — see the method comment.
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize, mergeMap } from 'rxjs/operators';

import { Account } from 'app/core/auth/account.model';
import { AccountService } from 'app/core/auth/account.service';
import { ActingAsService } from 'app/core/auth/acting-as.service';
import { AuthServerProvider } from 'app/core/auth/auth-jwt.service';
import { SessionBootstrapService } from 'app/fork/session-bootstrap.service';
import { Login } from './login.model';

@Injectable({ providedIn: 'root' })
export class LoginService {
  private readonly router = inject(Router);
  private readonly bootstrap = inject(SessionBootstrapService);

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
    this.bootstrap.reset();
    return this.authServerProvider.login(credentials).pipe(mergeMap(() => this.accountService.identity(true)));
  }

  /**
   * <b>Clearing here, rather than in the component that offers the menu item, is deliberate:</b> this is the one
   * path all three callers share, and one of them is `AuthExpiredInterceptor` — a session that expires is exactly
   * when nobody is thinking about the acting-as selection. It used to be cleared nowhere at all, so a care angel's
   * choice survived into the next person's session at the same browser, and because `setAvailable` accepts a
   * remembered id that is still valid it was applied silently, with no picker and no announcement.
   */
  /**
   * <b>Signing out routes, here, and does not on the web.</b> The web leaves that to the caller because every
   * caller is the navbar, and behind the navbar is an address bar and a back button — a page that stayed put
   * after signing out is untidy rather than fatal. On a phone there is none of that, and two of the four callers
   * are dead ends whose <em>only</em> control is this one: `ForkFailedPage` and `DeadEndPage`. Leaving them to
   * navigate themselves is the arrangement that trapped a signed-in administrator behind "your session has
   * expired" with a button that cleared the session and moved nothing — the fix cannot live in the two screens,
   * because the trap is what happens when a screen forgets, and the next dead end would forget again.
   *
   * <p>`finalize` rather than `complete` for the same reason. `complete` does not run when the request to the
   * gateway fails, so the one case where signing out matters most — the session is already broken — was the case
   * that left {@link AccountService} still holding the account. The local state is ours to drop and the server
   * call is a courtesy; the courtesy failing must not keep somebody signed in.</p>
   */
  logout(): void {
    this.actingAsService.clear();
    this.bootstrap.reset();
    this.authServerProvider
      .logout()
      .pipe(finalize(() => this.accountService.authenticate(null)))
      .subscribe({ error: () => null });
    void this.router.navigate(['/login']);
  }
}
