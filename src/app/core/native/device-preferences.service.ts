/**
 * New in hc-patient-app — no origin in the web repo.
 *
 * `previousUrl` and `locale` move out of sessionStorage and into Capacitor Preferences (§7.6).
 * Neither is a secret, so neither belongs in the secure store; both need to outlive a process kill,
 * so neither can stay in memory.
 *
 * The awkward part is that `StateStorageService` reads them synchronously and Preferences is async.
 * Unlike the token, that is safe to solve with a write-through cache rather than an explicit
 * unlock: a stale `previousUrl` costs a redirect to the wrong screen once, whereas a stale token
 * costs a 401 on every request. {@link hydrate} fills the cache during startup; reads before it
 * resolves see null, which is the same answer a fresh install gives.
 */

import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export const PREVIOUS_URL_KEY = 'previousUrl';
export const LOCALE_KEY = 'locale';

@Injectable({ providedIn: 'root' })
export class DevicePreferencesService {
  private readonly cache = new Map<string, string | null>();

  /** Called by the APP_INITIALIZER, before any component reads these. */
  async hydrate(): Promise<void> {
    for (const key of [PREVIOUS_URL_KEY, LOCALE_KEY]) {
      try {
        const { value } = await Preferences.get({ key });
        this.cache.set(key, value);
      } catch {
        this.cache.set(key, null);
      }
    }
  }

  get(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.cache.set(key, value);
    // Fire and forget: the cache is what anything reads this turn, and a failed write costs a
    // redirect after a process kill, not correctness now.
    void Preferences.set({ key, value }).catch(() => undefined);
  }

  remove(key: string): void {
    this.cache.set(key, null);
    void Preferences.remove({ key }).catch(() => undefined);
  }
}

/** Convenience for the APP_INITIALIZER, which runs outside an injection context by then. */
export const hydratePreferences = (): Promise<void> => inject(DevicePreferencesService).hydrate();
