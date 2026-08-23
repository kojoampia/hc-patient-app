/**
 * New in hc-patient-app. Shape reference:
 *   hc-patient-dashboard src/main/webapp/app/account/register/register.service.ts @ 12e418c
 *   hc-patient-dashboard src/main/webapp/app/account/password-reset/{init,finish}/*.service.ts @ 12e418c
 * Divergence: the web's three one-method services are one here. They hit three endpoints on the
 *   same gateway controller, are used by three screens that sit together in the same flow, and
 *   splitting them bought the web nothing this app would use.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApplicationConfigService } from 'app/core/config/application-config.service';

/** What `POST /api/register` accepts. `langKey` decides the language of the activation mail. */
export interface Registration {
  login: string;
  email: string;
  password: string;
  langKey: string;
}

/**
 * The three unauthenticated account calls, all on the gateway.
 *
 * <p>The gateway rather than the api, and that is not an implementation detail: it is the only
 * service with a `User` domain — `api` runs `skipUserManagement: true` — so creating an account,
 * activating one and resetting a password can only happen there (§1). These paths therefore have
 * no `/services/hcpatientservice/` prefix and must not acquire one.</p>
 *
 * <p>All three are already in `auth.interceptor.ts`'s unauthenticated allowlist, which predates any
 * screen calling them: the plumbing was written expecting these pages, and until 2026-08-23 they
 * did not exist.</p>
 */
@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly http = inject(HttpClient);
  private readonly applicationConfig = inject(ApplicationConfigService);

  /** Creates the account. The gateway grants ROLE_USER + ROLE_PATIENT and sends an activation mail. */
  register(registration: Registration): Observable<object> {
    return this.http.post(this.applicationConfig.getEndpointFor('api/register'), registration);
  }

  /**
   * Asks for a reset mail.
   *
   * <p>The body is the bare email as `text/plain`, not JSON — the gateway's controller takes a
   * `@RequestBody String`. Sending `{ "mail": "…" }` reaches it as a literal brace-wrapped string
   * and matches no account, which fails as "no such user" rather than as a malformed request.</p>
   */
  requestReset(mail: string): Observable<object> {
    return this.http.post(this.applicationConfig.getEndpointFor('api/account/reset-password/init'), mail);
  }

  /** Completes the reset with the key from the mail. */
  finishReset(key: string, newPassword: string): Observable<object> {
    return this.http.post(this.applicationConfig.getEndpointFor('api/account/reset-password/finish'), { key, newPassword });
  }
}
