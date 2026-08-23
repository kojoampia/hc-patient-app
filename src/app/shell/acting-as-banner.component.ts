/**
 * New in hc-patient-app. The web's equivalent lives inside `layouts/shell`; the CSS
 * (`.hc-shell__acting-as` and its `.is-own` state) ports straight across, the markup does not.
 *
 * **THIS IS A SAFETY CONTROL, NOT DECORATION** (patient-mobile.md §3, §7.4).
 *
 * The failure it prevents is an angel reading a blood group or an allergy list believing it is their
 * own. That is why it says whose record is open persistently and unmissably, and why it is rendered
 * by the shell rather than by each page — see TabsPage for the argument.
 */

import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { IonButton } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AccountService } from 'app/core/auth/account.service';
import { ActingAsService } from 'app/core/auth/acting-as.service';
import { Authority } from 'app/config/authority.constants';

@Component({
  selector: 'hpm-acting-as-banner',
  templateUrl: './acting-as-banner.component.html',
  styleUrl: './acting-as-banner.component.scss',
  imports: [IonButton, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActingAsBannerComponent {
  private readonly actingAs = inject(ActingAsService);
  private readonly translate = inject(TranslateService);
  private readonly account = inject(AccountService);

  /**
   * The live region's text, republished on each fork run.
   *
   * Declared here with the other private fields rather than beside `liveText`, per the
   * member-ordering rule: private instance fields come before public ones because `inject()` runs
   * in field-initialiser order and a public field derived from an injected service only works if
   * the service field is declared above it.
   */
  private readonly announcement = signal('');

  /**
   * Incremented by SessionBootstrapService after every fork run.
   *
   * §6 decision 4's consequence, and the reason this input exists at all: an angel holding exactly
   * one delegation is auto-selected on every cold start, so the banner's string is UNCHANGED and
   * `role="status"` will not re-announce it. A screen reader user would be told whose record is
   * open exactly once, ever. Watching a counter rather than the text is what makes the
   * re-announcement possible.
   */
  readonly runCount = input(0);

  readonly switchRequested = output<void>();
  readonly findRequested = output<void>();

  readonly current = this.actingAs.current;
  readonly isOwn = computed(() => !this.actingAs.actingForSomeoneElse());

  /** A switch is only offered when there is something to switch to. */
  readonly canSwitch = computed(() => this.actingAs.available().length > 1);

  /**
   * Whether to offer a way back to the finder.
   *
   * <p>An administrator reaches a record by searching for it, so after opening one they hold
   * exactly one choice — which makes {@link canSwitch} false and leaves them with no route to a
   * second patient short of signing out or waiting for the resume reset. The picker cannot help:
   * it can only offer what is already in `available()`, and the whole point is to reach somebody
   * who is not.</p>
   *
   * <p>Keyed on the role rather than on the choice count, because "I can search for anyone" is a
   * property of being an administrator and not of how many records they happen to have opened.</p>
   */
  readonly canFind = computed(() => this.account.hasAnyAuthority(Authority.ADMIN));

  /**
   * The live region's text. Cleared and re-set on a microtask so the region observes a change even
   * when the string is identical — see {@link runCount}.
   */
  readonly liveText = this.announcement.asReadonly();

  constructor() {
    effect(() => {
      // Depend on both, so a re-run with an unchanged selection still fires.
      this.runCount();
      const choice = this.current();

      const text = choice
        ? choice.own
          ? this.translate.instant('patientPortal.actingAs.bannerOwn')
          : this.translate.instant('patientPortal.actingAs.banner', { name: choice.name })
        : '';

      this.announcement.set('');
      queueMicrotask(() => this.announcement.set(text));
    });
  }
}
