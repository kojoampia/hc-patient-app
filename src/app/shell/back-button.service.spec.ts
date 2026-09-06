import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ActionSheetController, AlertController, IonRouterOutlet, ModalController, PopoverController } from '@ionic/angular';

import { NativePromptGuard } from 'app/core/native/with-prompt';
import { BackButtonService } from './back-button.service';

/**
 * What the Android hardware back button does, and — the point of `docs/backlog.md` item 10 — what it
 * must stop doing.
 *
 * <p>There was no spec over this file at all, and the reason is worth keeping rather than quietly
 * fixing: `start()` returns immediately unless `Capacitor.isNativePlatform()`, so under Jest the
 * handler was never registered and there was nothing to call. A browser has no hardware back key
 * either, so `ng serve` could not show it and neither could the production build. The defect —
 * back leaving the More sheet open and offering "Close BridgeCare?" on top of it — was found on a
 * handset because that was the only place it existed.</p>
 *
 * <p>So the platform is stubbed native and the real `ionBackButton` registration is exercised:
 * these tests capture the handler the service registers and invoke it, rather than reaching past
 * it into a private method. That way the priority, and the fact that it registers at all, are
 * covered by the same setup that covers the behaviour.</p>
 */

/** Ionic dispatches `ionBackButton` and collects handlers by priority; this stands in for that. */
interface CapturedHandler {
  priority: number;
  handler: () => void;
}

/**
 * A presented overlay, cut down to what the service reads. `overlayIndex` is Ionic's own
 * presentation counter and is what "topmost" means across four controllers that each see only
 * their own kind.
 */
function overlay(overlayIndex: number, backdropDismiss = true): { overlayIndex: number; backdropDismiss: boolean; dismiss: jest.Mock } {
  return { overlayIndex, backdropDismiss, dismiss: jest.fn().mockResolvedValue(true) };
}

describe('BackButtonService', () => {
  let service: BackButtonService;
  let captured: CapturedHandler[];

  let alerts: { getTop: jest.Mock; create: jest.Mock };
  let actionSheets: { getTop: jest.Mock };
  let modals: { getTop: jest.Mock };
  let popovers: { getTop: jest.Mock };
  let outlet: { canGoBack: jest.Mock; pop: jest.Mock };
  let router: { url: string };

  /** The alert `confirmExit()` raises. Kept so tests can assert it was NOT offered. */
  let exitAlert: { present: jest.Mock; onDidDismiss: jest.Mock };

  /**
   * Held rather than asserted through `App.exitApp`.
   *
   * `@capacitor/app` exposes its plugin through a proxy, so `jest.restoreAllMocks()` does not reach
   * the spy and the call count carries into the next test — which presents as a passing test
   * failing the one after it, not as a leak. Naming the spy and clearing it explicitly is what
   * makes each case independent.
   */
  let exitApp: jest.SpyInstance;

  /**
   * Fires one press through the highest-priority registered handler, as Ionic's dispatcher does.
   *
   * The handler is `() => void this.onBack()`, so nothing is awaited at the call site and the work
   * settles on the microtask queue. Drained with a macrotask rather than a fixed number of
   * `Promise.resolve()`s — `confirmExit()` chains four awaits deep, and counting them wrong does
   * not fail honestly: the assertions simply land one test late, which reads as unrelated tests
   * leaking into each other.
   */
  async function pressBack(): Promise<void> {
    const top = captured.reduce((best, h) => (h.priority >= best.priority ? h : best));
    top.handler();
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    exitApp = jest.spyOn(App, 'exitApp').mockResolvedValue(undefined);
    exitApp.mockClear();

    captured = [];
    jest.spyOn(document, 'addEventListener').mockImplementation((type, listener) => {
      if (type !== 'ionBackButton') {
        return;
      }
      const event = new CustomEvent('ionBackButton', {
        detail: {
          register: (priority: number, handler: () => void) => captured.push({ priority, handler }),
        },
      });
      (listener as EventListener)(event);
    });

    exitAlert = { present: jest.fn().mockResolvedValue(undefined), onDidDismiss: jest.fn().mockResolvedValue({ role: 'cancel' }) };
    alerts = { getTop: jest.fn().mockResolvedValue(undefined), create: jest.fn().mockResolvedValue(exitAlert) };
    actionSheets = { getTop: jest.fn().mockResolvedValue(undefined) };
    modals = { getTop: jest.fn().mockResolvedValue(undefined) };
    popovers = { getTop: jest.fn().mockResolvedValue(undefined) };
    outlet = { canGoBack: jest.fn().mockReturnValue(false), pop: jest.fn().mockResolvedValue(true) };
    router = { url: '/tabs/overview' };

    TestBed.configureTestingModule({
      providers: [
        BackButtonService,
        NativePromptGuard,
        { provide: AlertController, useValue: alerts },
        { provide: ActionSheetController, useValue: actionSheets },
        { provide: ModalController, useValue: modals },
        { provide: PopoverController, useValue: popovers },
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(BackButtonService);
    service.register(outlet as unknown as IonRouterOutlet);
  });

  afterEach(() => jest.restoreAllMocks());

  it('registers one handler, above the priority that exits the app', () => {
    expect(captured).toHaveLength(1);
    // 100 is Ionic's OVERLAY_BACK_BUTTON_PRIORITY; the exit handler is below it.
    expect(captured[0].priority).toBeGreaterThan(100);
  });

  describe('with an overlay open — backlog item 10', () => {
    it('dismisses the sheet instead of offering to quit the app', async () => {
      const sheet = overlay(1);
      modals.getTop.mockResolvedValue(sheet);

      await pressBack();

      expect(sheet.dismiss).toHaveBeenCalledWith(undefined, 'backdrop');
      // The measured symptom: the sheet stayed up AND "Close BridgeCare?" appeared over it.
      expect(alerts.create).not.toHaveBeenCalled();
      expect(outlet.pop).not.toHaveBeenCalled();
    });

    it('does not pop the page behind the overlay', async () => {
      modals.getTop.mockResolvedValue(overlay(1));
      outlet.canGoBack.mockReturnValue(true);

      await pressBack();

      // Mid-stack this was the worse half: the overlay was left floating over a screen the reader
      // never chose.
      expect(outlet.pop).not.toHaveBeenCalled();
    });

    it('closes the topmost overlay when several are open, not the first controller asked', async () => {
      const under = overlay(1);
      const over = overlay(2);
      alerts.getTop.mockResolvedValue(over);
      modals.getTop.mockResolvedValue(under);

      await pressBack();

      expect(over.dismiss).toHaveBeenCalled();
      expect(under.dismiss).not.toHaveBeenCalled();
    });

    it('consumes the press without dismissing an overlay that opted out of backdrop dismissal', async () => {
      const undismissable = overlay(1, false);
      modals.getTop.mockResolvedValue(undismissable);

      await pressBack();

      expect(undismissable.dismiss).not.toHaveBeenCalled();
      // Consumed, not fallen through: exiting the app from behind a deliberately modal dialog is
      // worse than the press appearing to do nothing.
      expect(alerts.create).not.toHaveBeenCalled();
      expect(outlet.pop).not.toHaveBeenCalled();
    });

    it('dismisses an alert raised over a terminal route rather than swallowing the press', async () => {
      router.url = '/lock';
      const onLock = overlay(1);
      alerts.getTop.mockResolvedValue(onLock);

      await pressBack();

      // Dismissing does not LEAVE the lock, so the terminal-route rule has nothing to say here.
      expect(onLock.dismiss).toHaveBeenCalledWith(undefined, 'backdrop');
    });
  });

  describe('with nothing open — the behaviour item 10 must not disturb', () => {
    it('pops within the tab stack', async () => {
      outlet.canGoBack.mockReturnValue(true);

      await pressBack();

      expect(outlet.pop).toHaveBeenCalled();
      expect(alerts.create).not.toHaveBeenCalled();
    });

    it('asks before exiting from a tab root', async () => {
      await pressBack();

      expect(alerts.create).toHaveBeenCalledWith(expect.objectContaining({ header: 'Close BridgeCare?' }));
      expect(exitAlert.present).toHaveBeenCalled();
    });

    it('exits only when the confirm is accepted', async () => {
      exitAlert.onDidDismiss.mockResolvedValue({ role: 'confirm' });

      await pressBack();

      expect(exitApp).toHaveBeenCalled();
    });

    it('stays put when the confirm is declined', async () => {
      await pressBack();

      expect(exitApp).not.toHaveBeenCalled();
    });

    it('swallows the press on a terminal route', async () => {
      router.url = '/lock';

      await pressBack();

      expect(outlet.pop).not.toHaveBeenCalled();
      expect(alerts.create).not.toHaveBeenCalled();
      expect(exitApp).not.toHaveBeenCalled();
    });
  });
});
