/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/core/auth/state-storage.service.ts @ 12e418c
 * Divergence: token methods delegate to SessionTokenService (secure storage behind a synchronous
 *   in-memory read); previousUrl and locale move to Capacitor Preferences. The PUBLIC SHAPE IS
 *   UNCHANGED — that is the whole point, and it is what lets AuthInterceptor and AuthServerProvider
 *   be lifted verbatim. See patient-mobile.md §7.6.
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable, inject } from '@angular/core';

import { DevicePreferencesService, LOCALE_KEY, PREVIOUS_URL_KEY } from 'app/core/native/device-preferences.service';
import { SessionTokenService } from 'app/core/native/session-token.service';

/**
 * Same method names, same signatures, same synchronous returns as the web's version. Only the
 * storage underneath changed.
 *
 * Three notes on what did NOT survive the port:
 *
 *  - `sessionStorage` and `localStorage` are gone entirely. A Capacitor webview's "session" can
 *    last weeks, survives process death, and survives a different account signing in, so neither
 *    web storage carries the meaning its name implies here.
 *  - **`rememberMe` is ignored.** On the web it chose between the two web storages. Here §6
 *    decision 5 forces it true and does not render the checkbox, so there is exactly one behaviour
 *    to implement. The parameter is kept so the signature matches and `AuthServerProvider` compiles
 *    unedited.
 *  - `storeAuthenticationToken` is void but the underlying write is async. Callers do not await it
 *    on the web either, and the in-memory signal is updated synchronously inside `persist()`, so
 *    the very next `getAuthenticationToken()` is correct regardless of whether the disk write has
 *    landed.
 */
@Injectable({ providedIn: 'root' })
export class StateStorageService {
  private readonly sessionToken = inject(SessionTokenService);
  private readonly preferences = inject(DevicePreferencesService);

  storeUrl(url: string): void {
    this.preferences.set(PREVIOUS_URL_KEY, JSON.stringify(url));
  }

  getUrl(): string | null {
    const previousUrl = this.preferences.get(PREVIOUS_URL_KEY);
    return previousUrl ? (JSON.parse(previousUrl) as string | null) : previousUrl;
  }

  clearUrl(): void {
    this.preferences.remove(PREVIOUS_URL_KEY);
  }

  /**
   * @param rememberMe ignored — see the class comment. Kept for signature compatibility with the
   *   lifted AuthServerProvider.
   */
  storeAuthenticationToken(authenticationToken: string, rememberMe: boolean): void {
    void rememberMe;
    void this.sessionToken.persist(authenticationToken);
  }

  getAuthenticationToken(): string | null {
    return this.sessionToken.get();
  }

  clearAuthenticationToken(): void {
    void this.sessionToken.signOut();
  }

  storeLocale(locale: string): void {
    this.preferences.set(LOCALE_KEY, locale);
  }

  getLocale(): string | null {
    return this.preferences.get(LOCALE_KEY);
  }

  clearLocale(): void {
    this.preferences.remove(LOCALE_KEY);
  }
}
