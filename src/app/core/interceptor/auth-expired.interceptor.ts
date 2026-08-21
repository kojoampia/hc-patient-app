/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/core/interceptor/auth-expired.interceptor.ts @ 12e418c
 * Divergence: also clears the acting-as selection and the stored token on 401 — §6 decision 4's
 *   FOURTH TRIGGER, which PROVENANCE.md recorded as landing in phase 6. Converted to inject() so
 *   the added dependencies do not lengthen a constructor parameter list.
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';

import { LoginService } from 'app/login/login.service';
import { StateStorageService } from 'app/core/auth/state-storage.service';
import { AccountService } from 'app/core/auth/account.service';
import { ActingAsService } from 'app/core/auth/acting-as.service';
import { SessionTokenService } from 'app/core/native/session-token.service';

@Injectable()
export class AuthExpiredInterceptor implements HttpInterceptor {
  private readonly loginService = inject(LoginService);
  private readonly stateStorageService = inject(StateStorageService);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly actingAs = inject(ActingAsService);
  private readonly sessionToken = inject(SessionTokenService);

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      tap({
        error: (err: HttpErrorResponse) => {
          if (err.status === 401 && err.url && !err.url.includes('api/account') && this.accountService.isAuthenticated()) {
            this.stateStorageService.storeUrl(this.router.routerState.snapshot.url);

            /**
             * §6 decision 4's fourth trigger, and the one phase 6's acceptance exercises: revoke a
             * delegation server-side, and the very next request 401s.
             *
             * The SELECTION must go with the session. An angel whose delegation was revoked still
             * holds the id of the patient they were acting for; leaving it set means the fork sees
             * a remembered choice on the next sign-in — and `setAvailable` accepts a remembered id
             * that is still in the list, so it would be applied silently, with no picker and no
             * announcement. That is the exact failure the web repo fixed on 2026-08-20.
             *
             * The token is cleared from the store too, not merely from memory: a 401 means it is
             * no longer worth anything, and leaving it on disk means the next cold start restores
             * a dead session and 401s again before showing the login screen.
             */
            this.actingAs.clear();
            void this.sessionToken.signOut();

            this.loginService.logout();
            this.router.navigate(['/login']);
          }
        },
      }),
    );
  }
}
