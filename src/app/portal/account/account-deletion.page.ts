/**
 * New in hc-patient-app. The in-app half of Google Play's account-deletion requirement; the other
 * half is a public web page that works for somebody who cannot sign in (WEB_DELETION_URL).
 *
 * ## Why this screen asks rather than does
 *
 * Every other destructive-looking control in this portal was left out on purpose — §4, and the
 * comment at the foot of profile.page.html. That has not changed. The patient service reserves
 * erasure to ROLE_ADMIN and this screen calls nothing that deletes; it records a request, shows the
 * date it is owed by, and lets the patient take it back.
 *
 * ## The two-step confirm is not decoration
 *
 * A single tap on a phone is one mis-touch away from asking for a medical record to be erased. So
 * the button reveals a panel that states the consequences and requires a second, differently
 * worded action. It is deliberately an in-page panel rather than an AlertController dialog: a
 * native dialog backgrounds nothing but is untestable without plugin mocks, and — the deciding
 * reason — it cannot show the fourteen-day promise and the list of what goes at the size the alert
 * gives it.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { FormsModule } from '@angular/forms';
import { IonButton, IonIcon, IonTextarea } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { ActingAsService } from 'app/core/auth/acting-as.service';
import { NativePromptGuard, withPrompt } from 'app/core/native/with-prompt';
import TranslateDirective from 'app/shared/language/translate.directive';

import { PortalPageComponent } from '../portal-page.component';
import { DeletionRequest, DeletionRequestService, PRIVACY_POLICY_URL } from '../data/deletion-request.service';
import { formatInstantDay } from '../data/portal-format';
import { Resource, LOADING, failed, loaded } from '../data/resource';

@Component({
  selector: 'hpm-account-deletion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, TranslateDirective, FormsModule, PortalPageComponent, IonButton, IonIcon, IonTextarea],
  templateUrl: './account-deletion.page.html',
  styleUrl: './account-deletion.page.scss',
})
export class AccountDeletionPage {
  private readonly deletionRequests = inject(DeletionRequestService);
  private readonly actingAs = inject(ActingAsService);
  private readonly promptGuard = inject(NativePromptGuard);

  readonly formatInstantDay = formatInstantDay;

  /**
   * Not a `toSignal` of a stream, unlike the rest of the portal.
   *
   * The other screens read data that changes underneath them; this one changes only because the
   * person looking at it pressed something, and every press has to be reflected immediately and
   * exactly. A refetch racing a local update here would show a patient that their request had not
   * been recorded when it had.
   */
  readonly request = signal<Resource<DeletionRequest | null>>(LOADING);

  readonly confirming = signal(false);
  readonly busy = signal(false);
  readonly reason = signal('');

  /** Set on a failed raise or cancel. A translation key, never a raw server message. */
  readonly actionError = signal<string | null>(null);

  /**
   * A care angel may not ask for the record they act for to be erased.
   *
   * The server refuses it (403 from DeletionRequestResource), so this is the second of two checks
   * rather than the only one — but a screen that offers a control the server will refuse is a
   * screen that teaches people the app is broken. §4's rule, applied to the one action where
   * getting it wrong is unrecoverable.
   */
  readonly actingForSomeoneElse = this.actingAs.actingForSomeoneElse;

  readonly pending = computed(() => {
    const resource = this.request();
    return resource.state === 'loaded' ? resource.value : null;
  });

  readonly isLoading = computed(() => this.request().state === 'loading');
  readonly isFailed = computed(() => this.request().state === 'failed');

  constructor() {
    this.reload();
  }

  reload(): void {
    this.request.set(LOADING);
    this.deletionRequests.mine().subscribe({
      next: request => this.request.set(loaded(request)),
      error: (error: unknown) => this.request.set(failed(error)),
    });
  }

  /** First tap: reveal the consequences. Nothing has been asked for yet. */
  startConfirm(): void {
    this.actionError.set(null);
    this.confirming.set(true);
  }

  /** The way out of the confirm panel, and it is the one styled as the primary action there. */
  abandon(): void {
    this.confirming.set(false);
  }

  /** Second tap, differently worded. This is the one that starts the clock. */
  confirm(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);

    this.deletionRequests.raise(this.reason()).subscribe({
      next: request => {
        this.request.set(loaded(request));
        this.confirming.set(false);
        this.reason.set('');
        this.busy.set(false);
      },
      error: () => {
        this.actionError.set('patientPortal.deleteAccount.error.raise');
        this.busy.set(false);
      },
    });
  }

  /** Withdraws it during the window — what makes a mis-tap survivable. */
  cancelRequest(): void {
    const pending = this.pending();
    if (!pending || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);

    this.deletionRequests.cancel(pending.id).subscribe({
      next: () => {
        this.request.set(loaded(null));
        this.busy.set(false);
      },
      error: () => {
        this.actionError.set('patientPortal.deleteAccount.error.cancel');
        this.busy.set(false);
      },
    });
  }

  /**
   * The policy, in the SYSTEM browser.
   *
   * `withPrompt` is mandatory — the system browser backgrounds the app and the resume handler would
   * otherwise lock the session. See core/native/with-prompt.ts.
   */
  async openPolicy(): Promise<void> {
    await withPrompt(this.promptGuard, () => Browser.open({ url: PRIVACY_POLICY_URL }));
  }
}
