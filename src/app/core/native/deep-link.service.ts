/**
 * New in hc-patient-app — no origin in the web repo, which is the thing being linked to.
 *
 * Turns an incoming `https://patient.abofonsa.com/...` link into a route in this app.
 */

import { Injectable, inject } from '@angular/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Router } from '@angular/router';

/**
 * The paths this app is willing to take over from the web.
 *
 * <p>An allowlist rather than "route whatever arrives", and that is the whole safety of this class.
 * The Android intent filter claims <em>every</em> link on `patient.abofonsa.com` — it was added so
 * the dead ends' "finish this on the web, then come back" could come back — so without a list here
 * a link to any web page would be silently swallowed by an app that has no such screen, and the
 * user would land on the sign-in page wondering what happened to the page they tapped.</p>
 *
 * <p>Anything not listed is handed back to the system browser by doing nothing: Android has already
 * opened the app, so the honest recovery is to leave the user where the app starts rather than to
 * guess a route.</p>
 */
const ROUTABLE = new Map<string, string>([
  // The password-reset mail. The key rides along as a query parameter, unchanged.
  ['/account/reset/finish', '/reset-password/finish'],
  ['/reset-password/finish', '/reset-password/finish'],
  // The activation mail lands somewhere this app has no screen for, so it is deliberately absent:
  // activation is a one-click server action and the browser is the right place for it.
]);

@Injectable({ providedIn: 'root' })
export class DeepLinkService {
  private readonly router = inject(Router);

  private started = false;

  /** Called once, from the APP_INITIALIZER, beside the other native listeners. */
  async start(): Promise<void> {
    if (this.started || !Capacitor.isNativePlatform()) {
      return;
    }
    this.started = true;

    await App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.open(event.url);
    });
  }

  /**
   * Routes one incoming URL. Exposed for tests, which cannot raise a native event.
   *
   * @param url the full link, as the system delivers it.
   */
  open(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      // A malformed link is not worth a crash on the very first thing the app does with it.
      return;
    }

    const target = ROUTABLE.get(parsed.pathname.replace(/\/+$/, ''));
    if (!target) {
      return;
    }

    const key = parsed.searchParams.get('key');
    void this.router.navigate([target], { queryParams: key ? { key } : {} });
  }
}
