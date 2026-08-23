/**
 * New in hc-patient-app. Shape reference:
 *   hc-patient-dashboard src/main/webapp/app/account/password-reset/finish/password-reset-finish.component.ts @ 12e418c
 * Divergence: the key arrives by deep link rather than by a browser URL — see the class comment.
 */

import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonInput, IonInputPasswordToggle, IonSpinner } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { BrandmarkComponent } from 'app/shared/ui/brandmark/brandmark.component';
import TranslateDirective from 'app/shared/language/translate.directive';

import { AccountApiService } from '../account-api.service';

/**
 * Completes a password reset.
 *
 * <h2>How the key gets here</h2>
 *
 * <p>The gateway mails a link to the <em>web</em> app. On a phone that link opens this app instead
 * when the deep-link filter matches (`capacitor.config.ts` and the Android intent filter), and the
 * `key` query parameter rides along unchanged — so the same mail serves both, and nothing about the
 * gateway or the mail template had to know this screen exists.</p>
 *
 * <p>A missing key is its own state rather than a validation error. Somebody who reaches this
 * screen without one has almost always opened the app directly instead of following the mail, and
 * telling them the key is missing is more useful than telling them a form is invalid.</p>
 */
@Component({
  selector: 'hpm-password-reset-finish',
  templateUrl: './password-reset-finish.page.html',
  styleUrl: './password-reset.page.scss',
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
export class PasswordResetFinishPage {
  private readonly accountApi = inject(AccountApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly success = signal(false);
  readonly failed = signal(false);

  /** Null when the screen was reached without following the mail. */
  readonly key = signal<string | null>(this.route.snapshot.queryParamMap.get('key'));

  readonly form = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4), Validators.maxLength(100)],
    }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  get passwordsMatch(): boolean {
    return this.form.controls.password.value === this.form.controls.confirm.value;
  }

  finish(): void {
    const key = this.key();
    if (!key || this.form.invalid || !this.passwordsMatch || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.failed.set(false);

    this.accountApi.finishReset(key, this.form.controls.password.value).subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.set(true);
      },
      // A reset key expires, and a stale one is the ordinary way this fails. The message says to
      // ask for another rather than reporting a status nobody can act on.
      error: () => {
        this.submitting.set(false);
        this.failed.set(true);
      },
    });
  }

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}
