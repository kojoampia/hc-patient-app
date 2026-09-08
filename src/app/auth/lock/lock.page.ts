/**
 * New in hc-patient-app — no origin in the web repo, which has no lock.
 *
 * §8.2 routes this outside the shell with `canDismiss: false`, and §8.4.8 requires that the Android
 * hardware back button does not escape it. A lock somebody can back out of is not a lock.
 */

import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonIcon, IonSpinner } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { AppLockService } from 'app/core/native/app-lock.service';
import { BrandmarkComponent } from 'app/shared/ui/brandmark/brandmark.component';

@Component({
  selector: 'hpm-lock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, BrandmarkComponent, IonContent, IonButton, IonIcon, IonSpinner],
  templateUrl: './lock.page.html',
  styleUrl: './lock.page.scss',
})
export class LockPage implements OnInit, OnDestroy {
  private readonly lock = inject(AppLockService);

  private backHandler?: (event: Event) => void;

  readonly busy = signal(false);

  /** 'cancelled' | 'unavailable' | 'failed', or null before the first attempt. */
  readonly outcome = signal<string | null>(null);

  /**
   * A translation KEY, not a sentence — the template pipes it through `translate`. Returning the
   * English here and interpolating it would put one more untranslated string on the one screen a
   * returning patient meets before anything else (backlog item 22).
   */
  readonly message = computed(() => {
    switch (this.outcome()) {
      case 'unavailable':
        // The device has no screen lock at all. There is nothing to unlock WITH, so the only
        // honest offer is signing in again — and §7.6 says refuse to keep the token on such a
        // device anyway.
        return 'patientPortal.lock.error.unavailable';
      case 'failed':
        return 'patientPortal.lock.error.failed';
      case 'cancelled':
        return null;
      default:
        return null;
    }
  });

  /** Only offered when there is something to retry with. */
  readonly canRetry = computed(() => this.outcome() !== 'unavailable');

  ngOnInit(): void {
    /**
     * §7.4.4 / §8.4.8. Ionic routes hardware back through its own overlay handling, so the lock has
     * to assert itself rather than assume. Backing out of the lock screen would leave somebody
     * inside the shell with no token — every request 401s and the app looks broken.
     */
    this.backHandler = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('ionBackButton', this.backHandler, { capture: true });

    // Prompt immediately: the user backgrounded the app and came back, so being asked to tap a
    // button before being asked for a fingerprint is one tap that says nothing.
    void this.attempt();
  }

  ngOnDestroy(): void {
    if (this.backHandler) {
      document.removeEventListener('ionBackButton', this.backHandler, { capture: true });
    }
  }

  async attempt(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    // A key: BiometricsService translates it, because the string lands in the OS prompt rather
    // than in a template where the pipe could reach it.
    const result = await this.lock.unlock('patientPortal.lock.reason');
    this.busy.set(false);

    if (result === 'unlocked') {
      this.outcome.set(null);
      return;
    }
    this.outcome.set(result);

    // Nothing to unlock with — do not strand them on a screen whose only button cannot work.
    if (result === 'unavailable') {
      await this.lock.abandon();
    }
  }

  /**
   * "Use password". BOTH this and Unlock are offered on failure (§7.6) — a lock screen with only a
   * retry is a trap the moment biometrics stop working, and a patient cannot reach their own record.
   */
  async usePassword(): Promise<void> {
    await this.lock.abandon();
  }
}
