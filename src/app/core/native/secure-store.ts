/**
 * New in hc-patient-app — no origin in the web repo.
 *
 * Plugins sit behind an interface so that no app code imports one directly and either side can be
 * swapped (patient-mobile.md §7.6). Nothing outside this folder should import
 * `@aparajita/capacitor-secure-storage` or `@capacitor/core`.
 */

import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';

/**
 * The narrowest thing the token store needs. Deliberately not the plugin's own surface: this app
 * stores exactly one secret, and a wider interface invites storing more.
 */
export interface SecureStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Android puts this in EncryptedSharedPreferences; iOS in the Keychain.
 *
 * `whenUnlockedThisDeviceOnly` maps to `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, and the
 * `ThisDeviceOnly` half is the load-bearing part on iOS: without it the item travels in an
 * encrypted backup and restores onto a different handset. iOS is phase 8, but the accessibility
 * flag is set here rather than there because it is a property of how the item was WRITTEN — items
 * already stored under a laxer flag keep it, so deferring this decision would mean a migration.
 *
 * The other iOS trap from §7.6 — the Keychain surviving app uninstall — is handled in
 * SessionTokenService, not here, because detecting a first run needs Preferences (which do not
 * survive uninstall) and this file must not know about them.
 */
class CapacitorSecureStore implements SecureStore {
  private readonly ready: Promise<void>;

  constructor() {
    this.ready = (async () => {
      await SecureStorage.setKeyPrefix('hcpatient.');
      await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
    })();
  }

  async getItem(key: string): Promise<string | null> {
    await this.ready;
    return SecureStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.ready;
    await SecureStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await this.ready;
    await SecureStorage.removeItem(key);
  }
}

/**
 * The non-native implementation, used by `ng serve` and by Jest.
 *
 * `sessionStorage`, NOT `localStorage`, and that choice is a safety property rather than an
 * accident: this store is only ever reached when there is no secure hardware to use, so anything it
 * holds should die with the browser session rather than sit on disk. It is never the store on a
 * device.
 */
class WebSecureStore implements SecureStore {
  getItem(key: string): Promise<string | null> {
    return Promise.resolve(sessionStorage.getItem(key));
  }

  setItem(key: string, value: string): Promise<void> {
    sessionStorage.setItem(key, value);
    return Promise.resolve();
  }

  removeItem(key: string): Promise<void> {
    sessionStorage.removeItem(key);
    return Promise.resolve();
  }
}

/**
 * `Capacitor.isNativePlatform()` is false under Jest, which selects WebSecureStore — setup-jest.ts
 * asserts that explicitly rather than leaving it to chance (§7.7).
 */
export const SECURE_STORE = new InjectionToken<SecureStore>('SecureStore', {
  providedIn: 'root',
  factory: () => (Capacitor.isNativePlatform() ? new CapacitorSecureStore() : new WebSecureStore()),
});
