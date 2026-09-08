/**
 * New in hc-patient-app — no origin in the web repo, which has a browser back button and none of
 * these problems.
 *
 * §8.4.8 has four parts. The first was done in phase 3, the middle two here, and the last was
 * missing until `docs/backlog.md` item 10:
 *
 *   1. must not dismiss `mustChoose`      — TabsPage, phase 3
 *   2. must pop within the tab's OWN stack — here
 *   3. must not exit the app from a tab root without a confirm — here
 *   4. must dismiss an open overlay before doing either — here, and see below
 *
 * (2) is Ionic's default and this only has to avoid breaking it, but (3) is not: Ionic's default
 * back handler exits the app from a root, silently and immediately. On this app that ends a session
 * a patient may have unlocked with a fingerprint thirty seconds earlier.
 *
 * **(4) is the part that taking over the button broke, and it is worth stating plainly.** Ionic
 * dismisses overlays from its own handler at `OVERLAY_BACK_BUTTON_PRIORITY = 100`, and Ionic's
 * dispatcher runs ONE handler per press — the highest-priority one — passing it a
 * `processNextHandler` callback to hand the press on. Registering at 101 to get in front of the
 * exit handler therefore gets in front of the overlay handler too, and this service never called
 * `processNextHandler` on any path. The measured result on a handset: with the More sheet open,
 * back left the sheet up and raised "Close BridgeCare?" on top of it — the reader asked to close a
 * sheet and was offered to quit the application.
 *
 * Delegating with `processNextHandler` is NOT the fix. Ionic only registers its overlay handler
 * when a dismissible overlay is actually open, so on a tab root with nothing open the press would
 * fall through to the built-in handler that exits — silently, which is exactly what (3) forbids.
 * The overlay has to be found and dismissed here, before either of the other two branches.
 */

import { Injectable, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ActionSheetController, AlertController, IonRouterOutlet, ModalController, PopoverController } from '@ionic/angular';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { NativePromptGuard, withPrompt } from 'app/core/native/with-prompt';

/**
 * Ionic's own handlers register at these priorities; anything above 100 runs before the one that
 * exits the app, which is what lets this intercept it.
 */
const EXIT_GUARD_PRIORITY = 101;

/** Routes with no "back" at all. Leaving any of them by hardware back is a defect, not a nicety. */
const TERMINAL_ROUTES = ['/login', '/lock', '/onboarding-required', '/invitations-required', '/fork-failed'];

/**
 * The role Ionic reports when its own handler dismisses an overlay by hardware back. Matched so a
 * caller reading `onDidDismiss().role` cannot tell the two apart — several already branch on
 * `'backdrop'` to mean "the reader declined without choosing".
 */
const BACK_DISMISS_ROLE = 'backdrop';

/**
 * The overlay kinds a back press should close, in Ionic's own sense of it.
 *
 * Deliberately NOT `ion-loading` or `ion-toast`, matching Ionic: dismissing a spinner does not
 * cancel the work behind it, and a toast is not something the reader is waiting to get out of.
 * Ionic reaches the same exclusion by a different route — it requires `backdropDismiss` to be
 * truthy, which is `false` by default on loading and absent entirely on toast.
 */
type DismissibleOverlay = HTMLIonAlertElement | HTMLIonActionSheetElement | HTMLIonModalElement | HTMLIonPopoverElement;

@Injectable({ providedIn: 'root' })
export class BackButtonService {
  private readonly alerts = inject(AlertController);
  private readonly actionSheets = inject(ActionSheetController);
  private readonly modals = inject(ModalController);
  private readonly popovers = inject(PopoverController);
  private readonly router = inject(Router);
  private readonly promptGuard = inject(NativePromptGuard);
  private readonly translate = inject(TranslateService);

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
    /**
     * (4) An open overlay is what the press refers to, so it is answered before the route is even
     * read. Ahead of the terminal-route check deliberately: dismissing an overlay does not LEAVE a
     * terminal screen, and swallowing the press there would strand somebody behind an alert on the
     * lock screen with no way back to it.
     */
    if (await this.dismissTopOverlay()) {
      return;
    }

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
   * Closes the topmost overlay, if there is one.
   *
   * Returns whether the press was CONSUMED, which is not the same as whether anything was
   * dismissed — an overlay that refuses to close still consumes the press. Letting it fall through
   * would exit the app from behind a dialog the author had deliberately made undismissable, which
   * is a worse outcome than the press appearing to do nothing.
   *
   * `mustChoose` never reaches here: `TabsPage` stops the `ionBackButton` event in the capture
   * phase while the fork is open, so no handler runs at all. Nothing below re-checks `canDismiss`,
   * and nothing needs to — `dismiss()` on a modal honours it and resolves `false`, leaving the
   * modal up while the press stays consumed. That is a third line of defence, after TabsPage's
   * listener and the `backdropDismiss: false` the fork also sets.
   */
  private async dismissTopOverlay(): Promise<boolean> {
    const top = await this.topOverlay();
    if (!top) {
      return false;
    }

    /**
     * `backdropDismiss: false` means "tapping outside does not close this". Hardware back is the
     * same gesture by a different input, and Ionic treats it that way — its handler tests exactly
     * this flag before registering — so an overlay that opts out of one opts out of both.
     */
    if (top.backdropDismiss) {
      await top.dismiss(undefined, BACK_DISMISS_ROLE);
    }
    return true;
  }

  /**
   * The topmost overlay across all four kinds.
   *
   * Each controller only knows about its own, so "top" has to be resolved across them, and
   * `overlayIndex` is what Ionic increments per presented overlay for exactly this. Picking by
   * arrival order of the `getTop()` promises, or by trying the controllers in a fixed sequence,
   * would close an alert sitting UNDER a modal and leave the modal on screen.
   */
  private async topOverlay(): Promise<DismissibleOverlay | undefined> {
    const tops = await Promise.all([this.alerts.getTop(), this.actionSheets.getTop(), this.modals.getTop(), this.popovers.getTop()]);

    return tops
      .filter((overlay): overlay is DismissibleOverlay => overlay !== undefined)
      .reduce<DismissibleOverlay | undefined>(
        (top, overlay) => (top === undefined || overlay.overlayIndex > top.overlayIndex ? overlay : top),
        undefined,
      );
  }

  /**
   * Asks before closing.
   *
   * `withPrompt` because a native alert backgrounds nothing but the confirm dialog can be dismissed
   * by the system in ways that look like a resume — and more importantly because `App.exitApp()`
   * must not be preceded by a lock. Suppressing here keeps the two from racing.
   *
   * The four strings are built by a controller rather than by a template, so no `translate` pipe
   * can reach them and they shipped as English in a three-locale app until backlog item 22.
   */
  private async confirmExit(): Promise<void> {
    const alert = await this.alerts.create({
      header: this.translate.instant('patientPortal.exit.title') as string,
      message: this.translate.instant('patientPortal.exit.body') as string,
      buttons: [
        { text: this.translate.instant('patientPortal.exit.stay') as string, role: 'cancel' },
        { text: this.translate.instant('patientPortal.action.close') as string, role: 'confirm' },
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
