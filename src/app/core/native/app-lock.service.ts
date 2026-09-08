/**
 * New in hc-patient-app — no origin in the web repo.
 *
 * THE ORDER IS LOAD-BEARING (§7.6):
 *
 *     resumed$ → AppLockService.lock()      clear the in-memory token, actingAs.clear(), → /lock
 *                   └─ unlock ok → SessionBootstrapService.restart() → the §3.2 fork
 *
 * The fork calls `/care-delegations/mine`, which needs a token, which needs the unlock. Running the
 * fork before the token is back in memory means every request in it goes out unauthenticated, the
 * fork fails, and the user lands on the retry screen having just successfully unlocked.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';

import { ActingAsService } from 'app/core/auth/acting-as.service';
import { SessionTokenService } from './session-token.service';
import { AppLifecycleService } from './app-lifecycle.service';
import { BiometricsService, UnlockOutcome } from './biometrics.service';

@Injectable({ providedIn: 'root' })
export class AppLockService {
  private readonly sessionToken = inject(SessionTokenService);
  private readonly actingAs = inject(ActingAsService);
  private readonly lifecycle = inject(AppLifecycleService);
  private readonly biometrics = inject(BiometricsService);
  private readonly router = inject(Router);
  private readonly nav = inject(NavController);

  private readonly lockedState = signal(false);

  readonly isLocked = computed(() => this.lockedState());

  /** Wired by the APP_INITIALIZER, after the token has been read back into memory. */
  start(): void {
    this.lifecycle.resumed$.subscribe(() => void this.lock());
  }

  /**
   * Locks the session.
   *
   * A LOCK IS NOT A SIGN-OUT: the token stays on disk and only the in-memory copy is cleared, so
   * unlocking restores the session rather than asking for a password. `SessionTokenService.lock()`
   * is the one that draws that line.
   *
   * The acting-as selection is cleared too (§6 decision 4). Whose record was open is exactly the
   * thing that must not survive an absence — the phone may have changed hands.
   */
  async lock(): Promise<void> {
    if (this.lockedState()) {
      return;
    }

    // Nothing to lock. A signed-out app showing a lock screen is a dead end with no way out.
    if (!this.sessionToken.hasToken()) {
      return;
    }

    this.lockedState.set(true);
    this.sessionToken.lock();
    this.actingAs.clear();

    // navigateRoot, not navigate: it unwinds every tab stack, so what sits behind the lock screen
    // is not the previous patient's case detail waiting to be revealed.
    await this.nav.navigateRoot('/lock');
  }

  /**
   * Attempts to unlock, and on success puts the token back and re-runs the fork.
   *
   * Returns the outcome so the lock screen can word its own failure — this service does not know
   * what a lock screen looks like.
   *
   * `reasonKey` is passed through untouched; {@link BiometricsService.unlock} translates it.
   */
  async unlock(reasonKey: string): Promise<UnlockOutcome> {
    const outcome = await this.biometrics.unlock(reasonKey);
    if (outcome !== 'unlocked') {
      return outcome;
    }

    // Token first. The fork's very first request needs it (see the file header).
    const token = await this.sessionToken.unlock();
    this.lockedState.set(false);

    if (!token) {
      // The store had nothing to give back — the session is genuinely over rather than paused.
      await this.router.navigate(['/login']);
      return 'unlocked';
    }

    /**
     * Back to the shell, NOT to wherever they were.
     *
     * The fork runs again on arrival (forkGuard sees an unresolved outcome), and §3.2's third row
     * may ask them to choose a record. Restoring the previous screen would put that question behind
     * a page belonging to a selection that no longer exists.
     */
    await this.nav.navigateRoot('/tabs/overview');
    return 'unlocked';
  }

  /** "Use password": end the session properly rather than leaving a token behind. */
  async abandon(): Promise<void> {
    this.lockedState.set(false);
    this.actingAs.clear();
    await this.sessionToken.signOut();
    await this.nav.navigateRoot('/login');
  }
}
