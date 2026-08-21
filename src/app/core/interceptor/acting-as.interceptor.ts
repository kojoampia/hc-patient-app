/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/core/interceptor/acting-as.interceptor.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ActingAsService } from 'app/core/auth/acting-as.service';
import { ApplicationConfigService } from '../config/application-config.service';

/** The header the patient service reads to work out whose records this request is about. */
export const ACTING_AS_HEADER = 'X-Acting-As';

/**
 * Puts the selected patient on every API request.
 *
 * <h2>Why this is an interceptor and not a service method</h2>
 *
 * <p>Once a care angel can act for somebody else, "which patient is this request about" stops being implied by the
 * token and becomes something every single call has to carry. A screen that builds its own request and forgets the
 * header does not fail — it silently reads the angel's own records instead of the patient's, or the other way round,
 * and answers 200 either way. Being in one interceptor is what makes forgetting impossible rather than merely
 * discouraged.</p>
 *
 * <p>The corresponding rule: <strong>nothing else may set this header.</strong> A service that sets it directly is
 * the same defect wearing a different hat.</p>
 *
 * <h2>It is not a claim</h2>
 *
 * <p>The backend re-reads the delegation on every request, so this header selects among records the caller has
 * already been shown to be entitled to. Sending a patient id you hold no active delegation for is refused exactly as
 * if you had guessed a record id — which is also why it is safe for this to be a header a browser could tamper
 * with.</p>
 */
@Injectable()
export class ActingAsInterceptor implements HttpInterceptor {
  constructor(
    private actingAsService: ActingAsService,
    private applicationConfigService: ApplicationConfigService,
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const serverApiUrl = this.applicationConfigService.getEndpointFor('');
    // Same guard the auth interceptor uses: never leak an internal header to a third-party host.
    if (!request.url || (request.url.startsWith('http') && !(serverApiUrl && request.url.startsWith(serverApiUrl)))) {
      return next.handle(request);
    }

    const patientId = this.actingAsService.header();
    if (!patientId) {
      // No selection yet — before the picker has run, or for somebody with only their own record. The backend reads
      // an absent header as "myself", which is the behaviour that existed before delegation and still the right
      // default.
      return next.handle(request);
    }

    return next.handle(request.clone({ headers: request.headers.set(ACTING_AS_HEADER, patientId) }));
  }
}
