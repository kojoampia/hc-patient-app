/**
 * New in hc-patient-app — no origin in the web repo, which has no app lifecycle.
 *
 * Exposes ONE signal: was this a cold start, or a resume after a long absence (§7.6). Everything
 * else about `appStateChange` is noise to the rest of the app.
 */

import { Injectable, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Subject } from 'rxjs';

import { NativePromptGuard } from './with-prompt';

export type ResumeKind = 'cold-start' | 'long-resume';

/**
 * How long backgrounded before a resume requires unlocking again.
 *
 * **15 minutes is a guess, and it is deliberately one exported constant so it can be tuned from
 * data rather than re-argued** (§6, "Still open, deliberately"). Biometrics on every resume is
 * aggressive for an app that is read-only in v1; never locking is wrong for an app showing somebody
 * else's medical record on a device that gets handed around.
 */
export const LONG_ABSENCE_MS = 15 * 60 * 1000;

const BACKGROUNDED_AT_KEY = 'backgroundedAt';

@Injectable({ providedIn: 'root' })
export class AppLifecycleService {
  private readonly promptGuard = inject(NativePromptGuard);

  private readonly resumed = new Subject<ResumeKind>();
  private started = false;

  /** Emits when the session should be re-established. Subscribed by AppLockService and nothing else. */
  readonly resumed$ = this.resumed.asObservable();

  /**
   * Called once, from the APP_INITIALIZER.
   *
   * A cold start is announced unconditionally — §6 decision 4's first trigger — before any listener
   * is attached, so the very first thing the app does is decide whether it is unlocked.
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    if (Capacitor.isNativePlatform()) {
      await App.addListener('appStateChange', ({ isActive }) => {
        void this.onStateChange(isActive);
      });
    }

    this.resumed.next('cold-start');
  }

  private async onStateChange(isActive: boolean): Promise<void> {
    /**
     * THE SUPPRESSION, and the reason with-prompt.ts exists (§7.6).
     *
     * The biometric dialog, the camera, the file picker and the system browser all background the
     * app on Android. Without this check the unlock prompt itself triggers a background, then a
     * resume, then another lock, then another prompt — a loop with no exit in which every
     * individual piece looks correct.
     */
    if (this.promptGuard.isSuppressed()) {
      return;
    }

    if (!isActive) {
      await this.remember(Date.now());
      return;
    }

    const since = await this.backgroundedAt();
    if (since !== null && Date.now() - since >= LONG_ABSENCE_MS) {
      this.resumed.next('long-resume');
    }
  }

  private async remember(at: number): Promise<void> {
    /**
     * Persisted rather than held in memory so that a PROCESS KILL still yields a sane answer on
     * relaunch. Android kills backgrounded apps freely; without this, coming back after two hours
     * to a killed process would look like a first run and skip the lock.
     *
     * §7.6 also notes the wall clock can move. A process kill always yields `cold-start` regardless,
     * so the worst case is a resume that should have locked and did not — acceptable. Do NOT chase
     * a monotonic clock across process death.
     */
    try {
      await Preferences.set({ key: BACKGROUNDED_AT_KEY, value: String(at) });
    } catch {
      // A failed write means the next resume is treated as short. It is the safe direction only
      // because a cold start locks unconditionally anyway.
    }
  }

  private async backgroundedAt(): Promise<number | null> {
    try {
      const { value } = await Preferences.get({ key: BACKGROUNDED_AT_KEY });
      const parsed = value === null ? Number.NaN : Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
