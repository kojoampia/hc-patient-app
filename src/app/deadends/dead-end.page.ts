/**
 * New in hc-patient-app. §6 decision 2's obligation: dropping the wizard does not drop the question
 * of where an un-onboarded user goes, so the fork's two terminal branches become dead ends.
 */

import { Component, computed, inject, input } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { IonButton, IonContent, IonIcon } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

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
  imports: [IonContent, IonButton, IonIcon, BrandmarkComponent, TranslateModule],
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
   *
   * TRANSLATION KEYS, not sentences; the template pipes each through `translate`. The English lived
   * here until backlog item 22, which meant a German or French patient met an English wall on one
   * of the two screens §6 decision 2 exists to make humane.
   *
   * Written out per branch rather than assembled from `kind()` — a key built by concatenation is
   * invisible to `i18n-keys.spec.ts`, which scans for quoted dotted literals. The sub-keys match
   * {@link DeadEndKind} all the same, so the pairing stays obvious.
   *
   * The onboarding copy was reworded on 2026-08-23, when registration landed in this app. Before
   * that, everybody reaching this screen had registered elsewhere and was being told something they
   * half expected. Now somebody can register on the phone, activate by mail, sign in — and arrive
   * here on their very first run, having done nothing wrong. It reads as the next step of a journey
   * rather than as a refusal, which is why it says what this app is for rather than only what is
   * missing. That wording now lives in `patientPortal.deadEnd.onboarding.body` in all three locales.
   */
  readonly copy = computed(() =>
    this.isOnboarding()
      ? {
          title: 'patientPortal.deadEnd.onboarding.title',
          body: 'patientPortal.deadEnd.onboarding.body',
          action: 'patientPortal.deadEnd.onboarding.action',
        }
      : {
          title: 'patientPortal.deadEnd.invitations.title',
          body: 'patientPortal.deadEnd.invitations.body',
          action: 'patientPortal.deadEnd.invitations.action',
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
