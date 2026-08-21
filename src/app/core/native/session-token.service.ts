/**
 * New in hc-patient-app — no origin in the web repo.
 *
 * THE SYNCHRONOUS-TOKEN PROBLEM, and its answer (patient-mobile.md §7.6).
 *
 * `StateStorageService.getAuthenticationToken()` is synchronous and `AuthInterceptor` calls it on
 * every single request. Secure storage is async. The obvious fix — make the interceptor async — is
 * wrong twice over: it is a keychain read per HTTP call, and it turns every interceptor spec async
 * for no benefit.
 *
 * So the token lives in an in-memory signal with a synchronous `get()`, and the async work
 * (`unlock`, `persist`, `lock`, `signOut`) happens around the secure store at the four moments that
 * actually change it. `StateStorageService` keeps its exact shape and delegates here, which is what
 * lets `AuthInterceptor` and `AuthServerProvider` be lifted verbatim.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import { SECURE_STORE } from './secure-store';

/**
 * Matches the web's `jhi-authenticationToken` so a reader of both repos sees the same name. The
 * secure store prefixes it (`hcpatient.`), so there is no collision with anything else on device.
 */
const TOKEN_KEY = 'jhi-authenticationToken';

/**
 * Written on first run. Lives in Preferences, NOT the secure store, precisely because Preferences
 * do not survive an uninstall and the iOS Keychain does — see clearIfFirstRun().
 */
const INSTALL_MARKER_KEY = 'installMarker';

@Injectable({ providedIn: 'root' })
export class SessionTokenService {
  private readonly store = inject(SECURE_STORE);

  /**
   * The single source of truth while the app is running. `lock()` clears this and leaves the store
   * alone; that is exactly the difference between locking and signing out.
   */
  private readonly token = signal<string | null>(null);

  private readonly persistable = signal(true);

  /** True when a token is held in memory right now. Not the same as "a token exists on disk". */
  readonly hasToken = computed(() => this.token() !== null);

  /**
   * False when the token was deliberately not written to disk, so the sign-in screen can say why
   * the user will have to type their password again next launch. See {@link persist}.
   */
  readonly isPersistable = computed(() => this.persistable());

  /**
   * The synchronous read `AuthInterceptor` depends on. Must stay synchronous — see the file header.
   */
  get(): string | null {
    return this.token();
  }

  /**
   * Read the stored token back into memory. Called once at startup, and again after the biometric
   * unlock.
   *
   * Order is load-bearing (§7.6): the §3.2 fork calls `/care-delegations/mine`, which needs a
   * token, which needs this to have resolved. Nothing may fetch before it does.
   */
  async unlock(): Promise<string | null> {
    await this.clearIfFirstRun();

    try {
      const stored = await this.store.getItem(TOKEN_KEY);
      this.token.set(stored);
      return stored;
    } catch {
      // A store that cannot be read is not a signed-in session. Fail closed and make them sign in
      // rather than surfacing a storage error on a login screen, where it means nothing.
      this.token.set(null);
      return null;
    }
  }

  /**
   * Hold the token in memory and write it to the secure store.
   *
   * §7.6: **if the device has no screen lock at all, refuse to persist.** Sign-in still works and
   * the session still runs — the token simply stays in memory and dies with the process, so the
   * user types their password every launch, and the copy says so.
   *
   * The detection landed in phase 6: the APP_INITIALIZER calls {@link setDevicePersistable} with
   * `BiometricsService.check().deviceIsSecure` before anything can sign in, so by the time this
   * runs the answer is known. On the web build it is always false, which is correct — `ng serve`
   * and Jest have no secure storage either.
   */
  async persist(token: string): Promise<void> {
    this.token.set(token);

    if (!this.persistable()) {
      await this.store.removeItem(TOKEN_KEY).catch(() => undefined);
      return;
    }

    try {
      await this.store.setItem(TOKEN_KEY, token);
    } catch {
      // In memory but not on disk: the session works now and ends at process death. Better than
      // refusing a sign-in that otherwise succeeded.
      this.persistable.set(false);
    }
  }

  /** Phase 6 calls this once device security is known. */
  setDevicePersistable(secure: boolean): void {
    this.persistable.set(secure);
  }

  /**
   * Forget the token in memory but leave it on disk. This is what a lock is: the session survives,
   * the app cannot act until it is unlocked again.
   */
  lock(): void {
    this.token.set(null);
  }

  /** Forget it everywhere. Signing out must not leave a token behind for the next person. */
  async signOut(): Promise<void> {
    this.token.set(null);
    await this.store.removeItem(TOKEN_KEY).catch(() => undefined);
  }

  /**
   * THE iOS UNINSTALL TRAP (§7.6), handled before the first read.
   *
   * **The iOS Keychain survives app uninstall.** Reinstalling therefore hands the new install the
   * previous one's token — possibly a previous *owner's*, on a resold or handed-down device. The
   * detection is a Preferences flag, which does NOT survive uninstall: no flag means this is a
   * first run, so anything already in the secure store predates this install and must go.
   *
   * Android's EncryptedSharedPreferences are cleared on uninstall, so this is a no-op there. It runs
   * on both because iOS is phase 8 and the flag has to have been written from the first run or
   * there is nothing to compare against when that phase arrives.
   */
  private async clearIfFirstRun(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: INSTALL_MARKER_KEY });
      if (value !== null) {
        return;
      }
      await this.store.removeItem(TOKEN_KEY).catch(() => undefined);
      await Preferences.set({ key: INSTALL_MARKER_KEY, value: '1' });
    } catch {
      // A Preferences failure must not block startup. The cost is a first run that did not clear,
      // which is the pre-existing behaviour rather than a new risk.
    }
  }
}
