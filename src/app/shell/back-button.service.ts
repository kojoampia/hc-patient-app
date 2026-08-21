/**
 * New in hc-patient-app — no origin in the web repo, which has a browser back button and none of
 * these problems.
 *
 * §8.4.8 has three parts, and only the first was done in phase 3:
 *
 *   1. must not dismiss `mustChoose`      — TabsPage, phase 3
 *   2. must pop within the tab's OWN stack — here
 *   3. must not exit the app from a tab root without a confirm — here
 *
 * (2) is Ionic's default and this only has to avoid breaking it, but (3) is not: Ionic's default
 * back handler exits the app from a root, silently and immediately. On this app that ends a session
 * a patient may have unlocked with a fingerprint thirty seconds earlier.
 */

import { Injectable, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AlertController, IonRouterOutlet } from '@ionic/angular';
import { Router } from '@angular/router';

import { NativePromptGuard, withPrompt } from 'app/core/native/with-prompt';

/**
 * Ionic's own handlers register at these priorities; anything above 100 runs before the one that
 * exits the app, which is what lets this intercept it.
 */
const EXIT_GUARD_PRIORITY = 101;

/** Routes with no "back" at all. Leaving any of them by hardware back is a defect, not a nicety. */
const TERMINAL_ROUTES = ['/login', '/lock', '/onboarding-required', '/invitations-required', '/fork-failed'];

@Injectable({ providedIn: 'root' })
export class BackButtonService {
  private readonly alerts = inject(AlertController);
  private readonly router = inject(Router);
  private readonly promptGuard = inject(NativePromptGuard);

  private outlet?: IonRouterOutlet;
  private started = false;

  /** Called once by TabsPage, which owns the outlet whose stack this pops. */
  register(outlet: IonRouterOutlet): void {
    this.outlet = outlet;
    this.start();
  }

  private start(): void {
    if (this.started || !Capacitor.isNativePlatform()) {
      return;
    }
    this.started = true;

    /**
     * ONE handler, registered through Ionic's own `ionBackButton` event rather than Capacitor's
     * `App.addListener('backButton')`. Both fire for the same press, so registering both would
     * pop twice — one tap skipping two screens, which reads as the app losing your place.
     *
     * Ionic's is the right one to use because it carries a PRIORITY, and priority is the entire
     * mechanism here: above 100 runs before the built-in handler that exits the app.
     */
    document.addEventListener('ionBackButton', (event: Event) => {
      (event as CustomEvent<{ register(priority: number, handler: () => void): void }>).detail.register(
        EXIT_GUARD_PRIORITY,
        () => void this.onBack(),
      );
    });
  }

  private async onBack(): Promise<void> {
    const url = this.router.url;

    /**
     * A terminal screen swallows back entirely. The lock is the important one — backing out of it
     * would leave somebody inside the shell with no token, so every request 401s and the app looks
     * broken rather than locked.
     */
    if (TERMINAL_ROUTES.some(route => url.startsWith(route))) {
      return;
    }

    // (2) Pop within this tab's own stack. Ionic tracks a stack per tab, so this returns to the
    // list the reader came from rather than jumping tabs.
    if (this.outlet?.canGoBack()) {
      await this.outlet.pop();
      return;
    }

    // (3) At a tab root there is nothing left to pop, and Ionic's default is to exit.
    await this.confirmExit();
  }

  /**
   * Asks before closing.
   *
   * `withPrompt` because a native alert backgrounds nothing but the confirm dialog can be dismissed
   * by the system in ways that look like a resume — and more importantly because `App.exitApp()`
   * must not be preceded by a lock. Suppressing here keeps the two from racing.
   */
  private async confirmExit(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Close BridgeCare?',
      message: 'You will need to unlock again next time.',
      buttons: [
        { text: 'Stay', role: 'cancel' },
        { text: 'Close', role: 'confirm' },
      ],
    });

    await withPrompt(this.promptGuard, async () => {
      await alert.present();
      const { role } = await alert.onDidDismiss();
      if (role === 'confirm') {
        await App.exitApp();
      }
    });
  }
}
