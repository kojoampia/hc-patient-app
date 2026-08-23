/**
 * New in hc-patient-app. Shape reference:
 *   hc-patient-dashboard src/main/webapp/app/account/register/register.component.ts @ 12e418c
 * Divergences: no username-availability probe (the web's needs a debounced round trip per keystroke
 *   and the endpoint is a convenience, not a rule — the server still refuses a taken login), and
 *   the single full-bleed layout the rest of this app's auth screens use rather than AuthShell.
 */

import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonInput, IonInputPasswordToggle, IonSpinner } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { BrandmarkComponent } from 'app/shared/ui/brandmark/brandmark.component';
import TranslateDirective from 'app/shared/language/translate.directive';

import { AccountApiService } from '../account-api.service';

/** What the gateway answers with when the login or the email is already spoken for. */
const LOGIN_TAKEN = 'userexists';
const EMAIL_TAKEN = 'emailexists';

@Component({
  selector: 'hpm-register',
  templateUrl: './register.page.html',
  styleUrl: './register.page.scss',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    TranslateDirective,
    BrandmarkComponent,
    IonContent,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
    IonSpinner,
  ],
})
export class RegisterPage {
  private readonly accountApi = inject(AccountApiService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly success = signal(false);

  /** One of the gateway's error keys, or null. Never a raw error string — a patient cannot use one. */
  readonly errorKey = signal<string | null>(null);

  readonly form = new FormGroup({
    login: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(254)] }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4), Validators.maxLength(100)],
    }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  /** Checked here rather than by a cross-field validator, so the message can sit under the field. */
  get passwordsMatch(): boolean {
    return this.form.controls.password.value === this.form.controls.confirm.value;
  }

  register(): void {
    if (this.submitting()) {
      return;
    }

    /**
     * Trimmed BEFORE validity is checked, not on the way out.
     *
     * `Validators.email` rejects a trailing space, so an address pasted with one — which is most of
     * them, from a mail app — left the form invalid and the button disabled, with the message
     * blaming the address the person had typed correctly.
     */
    this.form.patchValue({
      login: this.form.controls.login.value.trim(),
      email: this.form.controls.email.value.trim(),
    });

    if (this.form.invalid || !this.passwordsMatch) {
      return;
    }
    this.submitting.set(true);
    this.errorKey.set(null);

    const { login, email, password } = this.form.getRawValue();

    this.accountApi
      .register({
        login,
        email,
        password,
        // The gateway sends the activation mail in this language. Taken from what the app is
        // showing rather than from the device, so the mail matches the screen the person just read.
        langKey: this.translate.currentLang,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set(true);
        },
        error: (response: HttpErrorResponse) => {
          this.submitting.set(false);
          const type = (response.error as { errorKey?: string } | null)?.errorKey;
          this.errorKey.set(type === LOGIN_TAKEN || type === EMAIL_TAKEN ? type : 'fail');
        },
      });
  }

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}
