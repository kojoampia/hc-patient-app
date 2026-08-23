/**
 * New in hc-patient-app. Shape reference:
 *   hc-patient-dashboard src/main/webapp/app/account/password-reset/init/password-reset-init.component.ts @ 12e418c
 * Divergence: the single full-bleed layout this app's auth screens use rather than AuthShell.
 */

import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonInput, IonSpinner } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { BrandmarkComponent } from 'app/shared/ui/brandmark/brandmark.component';
import TranslateDirective from 'app/shared/language/translate.directive';

import { AccountApiService } from '../account-api.service';

@Component({
  selector: 'hpm-password-reset-request',
  templateUrl: './password-reset-request.page.html',
  styleUrl: './password-reset.page.scss',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    TranslateDirective,
    BrandmarkComponent,
    IonContent,
    IonInput,
    IonButton,
    IonSpinner,
  ],
})
export class PasswordResetRequestPage {
  private readonly accountApi = inject(AccountApiService);

  readonly submitting = signal(false);
  readonly success = signal(false);

  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(254)] }),
  });

  request(): void {
    if (this.submitting()) {
      return;
    }

    // Trimmed before validity is checked: Validators.email rejects a trailing space, and an address
    // pasted from a mail app usually has one.
    this.form.patchValue({ email: this.form.controls.email.value.trim() });

    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);

    this.accountApi.requestReset(this.form.controls.email.value).subscribe({
      /**
       * Success on both arms, deliberately.
       *
       * <p>The gateway answers 200 whether or not the address belongs to an account, so that this
       * screen cannot be used to find out who has one. Reporting a failure here would hand back
       * exactly the signal the server declines to give — and would also tell somebody who typed
       * their address correctly that something went wrong when nothing did.</p>
       */
      next: () => {
        this.submitting.set(false);
        this.success.set(true);
      },
      error: () => {
        this.submitting.set(false);
        this.success.set(true);
      },
    });
  }
}
