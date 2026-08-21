/**
 * New in hc-patient-app. §6 decision 2's obligation: dropping the wizard does not drop the question
 * of where an un-onboarded user goes, so the fork's two terminal branches become dead ends.
 */

import { Component, computed, inject, input } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { IonButton, IonContent, IonIcon } from '@ionic/angular';

import { LoginService } from 'app/login/login.service';
import { NativePromptGuard, withPrompt } from 'app/core/native/with-prompt';
import { BrandmarkComponent } from 'app/shared/ui/brandmark/brandmark.component';

/**
 * Which dead end this is. §3.2's fourth row exists precisely because these two are DIFFERENT
 * destinations, and the whole trap is arriving at the wrong one — so the distinction is a required
 * route input rather than a default.
 */
export type DeadEndKind = 'onboarding' | 'invitations';

/** Where each branch has to be finished. The portal, not the marketing site. */
const PORTAL_URL = 'https://patient.abofonsa.com';

@Component({
  selector: 'hpm-dead-end',
  templateUrl: './dead-end.page.html',
  styleUrl: './dead-end.page.scss',
  imports: [IonContent, IonButton, IonIcon, BrandmarkComponent],
})
export class DeadEndPage {
  private readonly loginService = inject(LoginService);
  private readonly promptGuard = inject(NativePromptGuard);

  /** Bound from route data via withComponentInputBinding(). */
  readonly kind = input.required<DeadEndKind>();

  readonly isOnboarding = computed(() => this.kind() === 'onboarding');

  /**
   * A screen that merely refuses is indistinguishable from a bug (§6 decision 2). Each of these
   * says what happened, what to do, and where — and then offers the button that does it.
   */
  readonly copy = computed(() =>
    this.isOnboarding()
      ? {
          title: 'Finish setting up your record',
          body:
            'Your account is ready, but your health record has not been set up yet. ' +
            'That is done on the web — it only takes a few minutes. Come back here afterwards and sign in again.',
          action: 'Set up on the web',
        }
      : {
          title: 'You have an invitation waiting',
          body:
            'Someone has asked you to be their care angel. You do not have a record of your own, ' +
            'so there is nothing to show here yet. Accept or decline the invitation on the web, then come back.',
          action: 'Open my invitations',
        },
  );

  /**
   * Opens the SYSTEM BROWSER, not an in-app webview, and that is the point (§6 decision 2): the
   * user's password manager and any existing session are available there. An in-app webview has
   * neither, which would ask somebody to type a password they do not know from memory.
   *
   * `withPrompt` is mandatory here — the system browser backgrounds the app, and phase 6's resume
   * handler would otherwise treat coming back as a long absence and lock the session the user is
   * in the middle of repairing. See core/native/with-prompt.ts.
   */
  async openPortal(): Promise<void> {
    const url = this.isOnboarding() ? `${PORTAL_URL}/onboarding` : `${PORTAL_URL}/invitations`;
    await withPrompt(this.promptGuard, () => Browser.open({ url }));
  }

  /**
   * The only other way out. Without it, somebody who signed in with the wrong account is stuck on a
   * screen with one button that takes them to a website — which is a trap, not a dead end.
   */
  signOut(): void {
    this.loginService.logout();
  }
}
