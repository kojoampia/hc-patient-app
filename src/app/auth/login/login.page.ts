/**
 * New in hc-patient-app. The web's LoginComponent is the shape reference, not the origin — its
 * template belongs to AuthShellComponent's split brand-left/form-right layout, which is a desktop
 * idea with no mobile analogue (patient-mobile.md §8.2). This is a single full-bleed ion-content
 * reusing the same `.hc-auth*` classes.
 */

import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonInput, IonInputPasswordToggle, IonSpinner } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { AccountService } from 'app/core/auth/account.service';
import { LoginService } from 'app/login/login.service';
import { SessionTokenService } from 'app/core/native/session-token.service';

@Component({
  selector: 'hpm-login',
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  imports: [ReactiveFormsModule, TranslateModule, IonContent, IonInput, IonInputPasswordToggle, IonButton, IonSpinner],
})
export class LoginPage {
  private readonly accountService = inject(AccountService);
  private readonly loginService = inject(LoginService);
  private readonly sessionToken = inject(SessionTokenService);
  private readonly router = inject(Router);

  readonly authenticationError = signal(false);
  readonly submitting = signal(false);

  /**
   * False when the token could not be written to the secure store, so the copy can say the user
   * will have to sign in again next launch rather than letting it look like a bug. See §7.6 — on a
   * device with no screen lock this app refuses to persist rather than keeping a 7-day token on
   * unsecured hardware, and the gateway has no revocation to fall back on.
   */
  readonly willNotPersist = this.sessionToken.isPersistable;

  /**
   * `rememberMe` is forced true and the checkbox is NOT rendered (§6 decision 5).
   *
   * The web offers the choice because a shared desktop browser is a real scenario. A phone is a
   * personal device, the token is going into the Keychain/Keystore either way, and the alternative
   * — asking a patient to re-type a password every launch — is how an app stops being opened. The
   * field stays in the form so `Login` and `AuthServerProvider` are used unmodified.
   */
  readonly loginForm = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    rememberMe: new FormControl(true, { nonNullable: true }),
  });

  login(): void {
    if (this.loginForm.invalid || this.submitting()) {
      return;
    }
    this.submitting.set(true);

    this.loginService.login(this.loginForm.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.authenticationError.set(false);
        if (!this.router.getCurrentNavigation()) {
          // No routing happened during login (e.g. from navigateToStoredUrl).
          void this.router.navigate(['']);
        }
      },
      error: () => {
        this.submitting.set(false);
        this.authenticationError.set(true);
      },
    });
  }

  /**
   * Deliberately NOT an ngOnInit `identity()` call like the web's.
   *
   * The web redirects an already-authenticated visitor away from /login. Here the §3.2 fork owns
   * where a signed-in person goes, and it runs in phase 3 — having two things decide that is how
   * a redirect loop starts. Until then the router simply lands on the portal.
   */
  isAuthenticated(): boolean {
    return this.accountService.isAuthenticated();
  }
}
