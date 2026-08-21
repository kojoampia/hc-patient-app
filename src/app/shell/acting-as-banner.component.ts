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

import { ActingAsService } from 'app/core/auth/acting-as.service';

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

  readonly current = this.actingAs.current;
  readonly isOwn = computed(() => !this.actingAs.actingForSomeoneElse());

  /** A switch is only offered when there is something to switch to. */
  readonly canSwitch = computed(() => this.actingAs.available().length > 1);

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
