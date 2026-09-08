/**
 * New in hc-patient-app — and it is the DOCUMENTED DIVERGENCE from the web (patient-mobile.md §8.3).
 *
 * When `/care-delegations/mine` fails, the web falls back to `setAvailable([])`. That is right for a
 * desktop portal already showing the signed-in person's own record. Here it is wrong: combined with
 * the cold-start reset in §6 decision 4, it turns a transient network failure into an angel-only
 * user staring at an empty portal **under their own name**, with the banner naming them — which is
 * the precise misinformation the banner exists to prevent.
 *
 * So a failed fork gets an explicit retry screen. Failing visibly beats failing plausibly, and this
 * is the one screen in the app whose whole purpose is to not guess.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { LoginService } from 'app/login/login.service';
import { SessionBootstrapService } from './session-bootstrap.service';

@Component({
  selector: 'hpm-fork-failed',
  templateUrl: './fork-failed.page.html',
  styleUrl: './fork-failed.page.scss',
  imports: [IonContent, IonButton, IonIcon, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForkFailedPage {
  private readonly bootstrap = inject(SessionBootstrapService);
  private readonly loginService = inject(LoginService);
  private readonly router = inject(Router);

  readonly outcome = this.bootstrap.outcome;

  /**
   * Keyed off status, never a raw error string (§7.5 sets the same rule for the data layer). A
   * patient has no use for "HttpErrorResponse 0 Unknown Error".
   *
   * Returns a TRANSLATION KEY, which the template pipes through `translate`. It returned English
   * until backlog item 22 — on a screen whose whole purpose is to not guess, in an app shipping
   * three locales. The offline wording is `stream.offline` rather than a fourth copy of the same
   * sentence: the data layer already says exactly this, in all three.
   */
  readonly message = computed(() => {
    const state = this.outcome();
    const status = state.kind === 'failed' ? state.status : null;

    if (status === null || status === 0) {
      return 'patientPortal.stream.offline';
    }
    if (status === 401 || status === 403) {
      /**
       * NOT "your session has expired", which this screen is in no position to know. The fork can be refused a
       * token it was never given — {@link AppLockService} takes the token out of memory before showing the lock
       * screen — so the sentence was told to people whose session was perfectly valid, and it sent them to sign
       * in again to fix something signing in does not fix. Say what happened, and offer both ways on.
       */
      return 'patientPortal.forkFailed.error.session';
    }
    return 'patientPortal.forkFailed.error.generic';
  });

  readonly isAuthProblem = computed(() => {
    const state = this.outcome();
    return state.kind === 'failed' && (state.status === 401 || state.status === 403);
  });

  async retry(): Promise<void> {
    this.bootstrap.restart();
    await this.router.navigate(['/tabs']);
  }

  signOut(): void {
    this.loginService.logout();
  }
}
