import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { Subject } from 'rxjs';

import { ActingAsService } from 'app/core/auth/acting-as.service';
import { AppLifecycleService, ResumeKind } from './app-lifecycle.service';
import { AppLockService } from './app-lock.service';
import { BiometricsService, UnlockOutcome } from './biometrics.service';
import { SessionTokenService } from './session-token.service';

/**
 * Phase 6's acceptance, minus the parts only a handset can answer.
 *
 * §7.8 verifies three things by hand: background past the threshold -> biometric -> unlock ->
 * picker returns; cancel the prompt -> NO LOCK LOOP; and revoke a delegation server-side -> 401 ->
 * login, selection cleared. What is testable here is the ORDER, which §7.6 says is load-bearing,
 * and the fact that locking is not signing out.
 */
describe('AppLockService', () => {
  let service: AppLockService;
  let resumed$: Subject<ResumeKind>;
  let actingAs: ActingAsService;

  let token: {
    hasToken: jest.Mock;
    lock: jest.Mock;
    unlock: jest.Mock;
    signOut: jest.Mock;
  };
  let biometrics: { unlock: jest.Mock };
  let nav: { navigateRoot: jest.Mock };

  beforeEach(() => {
    resumed$ = new Subject<ResumeKind>();
    token = {
      hasToken: jest.fn().mockReturnValue(true),
      lock: jest.fn(),
      unlock: jest.fn().mockResolvedValue('a-token'),
      signOut: jest.fn().mockResolvedValue(undefined),
    };
    biometrics = { unlock: jest.fn().mockResolvedValue('unlocked' as UnlockOutcome) };
    nav = { navigateRoot: jest.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        { provide: SessionTokenService, useValue: token },
        { provide: BiometricsService, useValue: biometrics },
        { provide: AppLifecycleService, useValue: { resumed$: resumed$.asObservable() } },
        { provide: NavController, useValue: nav },
        { provide: Router, useValue: { navigate: jest.fn().mockResolvedValue(true) } },
      ],
    });

    service = TestBed.inject(AppLockService);
    actingAs = TestBed.inject(ActingAsService);
    service.start();
  });

  describe('locking', () => {
    it('locks on a resume, clearing the in-memory token and the selection', async () => {
      actingAs.setAvailable([{ patientId: 'patient-kojo', name: 'Kojo', own: false }]);
      expect(actingAs.current()).not.toBeNull();

      resumed$.next('long-resume');
      await Promise.resolve();

      expect(token.lock).toHaveBeenCalled();
      // Whose record was open must not survive an absence — the phone may have changed hands.
      expect(actingAs.current()).toBeNull();
      expect(nav.navigateRoot).toHaveBeenCalledWith('/lock');
    });

    /**
     * A LOCK IS NOT A SIGN-OUT. The token stays on disk so unlocking restores the session; calling
     * signOut here would make every lock cost the patient their password.
     */
    it('does not remove the stored token', async () => {
      resumed$.next('long-resume');
      await Promise.resolve();

      expect(token.signOut).not.toHaveBeenCalled();
    });

    /** A signed-out app showing a lock screen is a dead end with no way out. */
    it('does nothing when there is no session to lock', async () => {
      token.hasToken.mockReturnValue(false);

      resumed$.next('cold-start');
      await Promise.resolve();

      expect(token.lock).not.toHaveBeenCalled();
      expect(nav.navigateRoot).not.toHaveBeenCalled();
    });

    it('is idempotent, so a burst of resume events produces one lock', async () => {
      resumed$.next('long-resume');
      resumed$.next('long-resume');
      await Promise.resolve();

      expect(nav.navigateRoot).toHaveBeenCalledTimes(1);
    });
  });

  describe('unlocking', () => {
    /**
     * THE ORDER §7.6 CALLS LOAD-BEARING: the fork calls /care-delegations/mine, which needs a
     * token, which needs this unlock. Running the fork first means every request in it goes out
     * unauthenticated and the user lands on the retry screen having just succeeded.
     */
    it('restores the token BEFORE navigating back into the shell', async () => {
      const order: string[] = [];
      token.unlock.mockImplementation(async () => {
        order.push('token');
        return 'a-token';
      });
      nav.navigateRoot.mockImplementation(async (url: string) => {
        order.push(`nav:${url}`);
        return true;
      });

      resumed$.next('long-resume');
      await Promise.resolve();
      order.length = 0;

      await service.unlock('why');

      expect(order).toEqual(['token', 'nav:/tabs/overview']);
    });

    it('reports a cancel without unlocking anything', async () => {
      biometrics.unlock.mockResolvedValue('cancelled' as UnlockOutcome);

      await expect(service.unlock('why')).resolves.toBe('cancelled');
      expect(token.unlock).not.toHaveBeenCalled();
    });

    it('sends the user to login when the store has nothing to give back', async () => {
      token.unlock.mockResolvedValue(null);
      const router = TestBed.inject(Router);

      await service.unlock('why');

      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('"Use password"', () => {
    it('ends the session properly rather than leaving a token behind', async () => {
      await service.abandon();

      expect(token.signOut).toHaveBeenCalled();
      expect(actingAs.current()).toBeNull();
      expect(nav.navigateRoot).toHaveBeenCalledWith('/login');
    });
  });
});
