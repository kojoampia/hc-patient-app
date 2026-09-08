/**
 * New in hc-patient-app — no origin in the web repo.
 *
 * The plugin sits behind this service so no app code imports
 * `@aparajita/capacitor-biometric-auth` directly (§7.6). Nothing outside `core/native/` should
 * know which plugin this is.
 */

import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryError, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';
import { TranslateService } from '@ngx-translate/core';

import { NativePromptGuard, withPrompt } from './with-prompt';

/** What the lock screen needs to know before it offers anything. */
export interface DeviceSecurity {
  /** A screen lock of any kind — PIN, pattern, password or biometric. */
  readonly deviceIsSecure: boolean;
  /** A biometric is enrolled and usable right now. */
  readonly biometryAvailable: boolean;
}

export type UnlockOutcome = 'unlocked' | 'cancelled' | 'unavailable' | 'failed';

@Injectable({ providedIn: 'root' })
export class BiometricsService {
  private readonly promptGuard = inject(NativePromptGuard);
  private readonly translate = inject(TranslateService);

  /**
   * Whether this device can keep a token at all.
   *
   * On the web build there is no biometry and no device lock, so it answers "not secure" — which
   * is correct rather than pessimistic: `ng serve` and Jest have no secure storage either, and
   * SessionTokenService's web fallback is sessionStorage precisely so nothing survives.
   */
  async check(): Promise<DeviceSecurity> {
    if (!Capacitor.isNativePlatform()) {
      return { deviceIsSecure: false, biometryAvailable: false };
    }
    try {
      const result = await BiometricAuth.checkBiometry();
      return { deviceIsSecure: result.deviceIsSecure, biometryAvailable: result.isAvailable };
    } catch {
      // A plugin that cannot answer is not a device we should trust with a 7-day token.
      return { deviceIsSecure: false, biometryAvailable: false };
    }
  }

  /**
   * Prompts to unlock.
   *
   * **`withPrompt` is mandatory and is the whole reason this method exists rather than the caller
   * touching the plugin** (§7.6). The biometric dialog backgrounds the app on Android, so the
   * resume listener sees it come back and locks again — showing the prompt that backgrounds the
   * app, which locks again. A loop with no exit, in which every individual piece looks correct.
   *
   * `allowDeviceCredential: true` so a patient whose fingerprint is not recognised — wet hands, a
   * cut, a cold morning — can use their PIN rather than being locked out of their own record.
   *
   * `reasonKey` is a TRANSLATION KEY, not a sentence. These three strings are drawn by the OS, not
   * by a template, so no `translate` pipe can reach them and they shipped as English in an app with
   * three locales until backlog item 22 — on the dialog a returning patient meets first.
   */
  async unlock(reasonKey: string): Promise<UnlockOutcome> {
    const security = await this.check();
    if (!security.deviceIsSecure) {
      return 'unavailable';
    }

    const reason = this.translate.instant(reasonKey) as string;

    try {
      await withPrompt(this.promptGuard, () =>
        BiometricAuth.authenticate({
          reason,
          allowDeviceCredential: true,
          cancelTitle: this.translate.instant('patientPortal.lock.usePassword') as string,
          androidTitle: this.translate.instant('patientPortal.lock.promptTitle') as string,
          androidSubtitle: reason,
        }),
      );
      return 'unlocked';
    } catch (error) {
      // A cancel is a decision, not a failure — the lock screen offers "Use password" for it and
      // must not present it as something that went wrong.
      if (error instanceof BiometryError && isCancellation(error)) {
        return 'cancelled';
      }
      return 'failed';
    }
  }
}

/**
 * The plugin distinguishes four ways a prompt can end without an answer, and they mean different
 * things to the platform but the same thing to us: the user chose not to authenticate just now.
 *
 * `userFallback` is included deliberately — it is what "Use password" reports, and the lock screen
 * offers exactly that, so treating it as a failure would show an error for a button we drew.
 */
const CANCELLED: readonly BiometryErrorType[] = [
  BiometryErrorType.userCancel,
  BiometryErrorType.systemCancel,
  BiometryErrorType.appCancel,
  BiometryErrorType.userFallback,
];

function isCancellation(error: BiometryError): boolean {
  return CANCELLED.includes(error.code);
}
