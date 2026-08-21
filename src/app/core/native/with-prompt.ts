/**
 * New in hc-patient-app — no origin in the web repo, which has no app lifecycle to fight.
 *
 * **THE MOST LIKELY BUG IN THIS AREA** (patient-mobile.md §7.6), written down before it happens.
 *
 * The biometric dialog, the camera, the file picker and the system browser ALL background the app
 * on Android. §6 decision 4 locks the session on resume after a long absence — so a naive listener
 * sees the app background, sees it resume, and re-locks. The user is then shown a biometric prompt
 * that itself backgrounds the app, which on completion triggers another lock. That is a loop with
 * no exit, and every individual piece of it looks correct in isolation.
 *
 * Every call into a native surface that can background the app must therefore be wrapped:
 *
 *     await withPrompt(() => Browser.open({ url }));
 *
 * `suppressNextResume()` is not optional and not a nicety. It is the difference between a lock
 * screen and a lock loop.
 */

import { Injectable, signal } from '@angular/core';

/**
 * Holds the suppression window. Phase 6's AppLifecycleService consults `isSuppressed()` before
 * acting on an `appStateChange`, which is the entire mechanism.
 *
 * It is a counter rather than a boolean because prompts can nest — a dead end opening the system
 * browser while a modal is already suppressing would otherwise un-suppress early.
 */
@Injectable({ providedIn: 'root' })
export class NativePromptGuard {
  private readonly depth = signal(0);

  isSuppressed(): boolean {
    return this.depth() > 0;
  }

  enter(): void {
    this.depth.update(n => n + 1);
  }

  /**
   * Left open for a grace period rather than closed immediately.
   *
   * The resume event does not arrive at the same moment the promise resolves — `Browser.open`
   * resolves when the browser has been ASKED to open, not when the user comes back, and the
   * appStateChange for the return lands afterwards. Closing the window synchronously would leave
   * the very event this exists to suppress unsuppressed.
   */
  exit(): void {
    setTimeout(() => this.depth.update(n => Math.max(0, n - 1)), RESUME_GRACE_MS);
  }
}

/**
 * How long after a native prompt returns a resume event is still attributed to that prompt.
 *
 * Exported and named so it can be tuned from evidence rather than re-argued, the same way
 * `LONG_ABSENCE_MS` is in phase 6.
 */
export const RESUME_GRACE_MS = 1_000;

/**
 * Runs `fn` with resume-handling suppressed, and restores it even if `fn` throws — a cancelled
 * biometric prompt is a rejected promise, and leaking the suppression would disable the lock
 * entirely rather than merely looping it.
 */
export async function withPrompt<T>(guard: NativePromptGuard, fn: () => Promise<T>): Promise<T> {
  guard.enter();
  try {
    return await fn();
  } finally {
    guard.exit();
  }
}
