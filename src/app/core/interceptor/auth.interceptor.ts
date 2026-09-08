/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/core/interceptor/auth.interceptor.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

import { StateStorageService } from 'app/core/auth/state-storage.service';
import { ApplicationConfigService } from '../config/application-config.service';

/**
 * The endpoints whose whole job is to get you a token, or to work without one.
 *
 * Sending a token to these is not merely pointless — it locks people out. Spring Security's bearer
 * filter runs *before* authorization, so a token that is present and expired fails the request
 * outright and `permitAll` never gets a say. Sign-in then answers 401 for a reason that has nothing
 * to do with the credentials typed into it, and because the stored token is what caused the failure,
 * trying again does the same thing. The only way out was to clear site data by hand.
 *
 * It bites whenever a token expires while the tab is closed, which is the ordinary case: come back
 * the next morning, and the portal refuses the password it would have accepted an hour earlier.
 *
 * Matched against the gateway's own anonymous list in `SecurityConfiguration`; keep the two in step.
 */
const ANONYMOUS_PATHS = [
  'api/authenticate',
  'api/register',
  'api/activate',
  'api/account/reset-password/init',
  'api/account/reset-password/finish',
  'api/account/username-available',
];

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private stateStorageService: StateStorageService,
    private applicationConfigService: ApplicationConfigService,
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const serverApiUrl = this.applicationConfigService.getEndpointFor('');
    if (!request.url || (request.url.startsWith('http') && !(serverApiUrl && request.url.startsWith(serverApiUrl)))) {
      return next.handle(request);
    }

    if (isAnonymous(request.url)) {
      return next.handle(request);
    }

    const token: string | null = this.stateStorageService.getAuthenticationToken();
    if (token) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
    return next.handle(request);
  }
}

/**
 * @param url the request URL, absolute or relative — the app builds relative ones, but a caller may
 *   pass an absolute URL against the same origin, and both must be recognised.
 * @return true when this is one of the endpoints that must never carry a token.
 */
function isAnonymous(url: string): boolean {
  const path = url
    .split('?')[0]
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\//, '');
  return ANONYMOUS_PATHS.some(anonymous => path === anonymous || path.endsWith(`/${anonymous}`));
}
