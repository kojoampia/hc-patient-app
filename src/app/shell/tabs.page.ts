/**
 * New in hc-patient-app — replaces `layouts/shell/shell.component.ts`.
 *
 * The shell, and the reason the banner lives here rather than on thirteen pages (§7.4).
 */

import { AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs, IonModal, ModalController, NavController } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { ActingAsService } from 'app/core/auth/acting-as.service';
import { PortalDataService } from 'app/portal/data/portal-data.service';
import { SessionBootstrapService } from 'app/fork/session-bootstrap.service';
import { ActingAsBannerComponent } from './acting-as-banner.component';
import { MOBILE_NAV, MOBILE_TABS, MobileNavItem, activeIcon } from './mobile-nav';
import { BackButtonService } from './back-button.service';
import { MoreSheetBus } from './more-sheet.bus';
import { MoreSheetComponent } from './more-sheet.component';
import { RecordPickerComponent } from './record-picker.component';

@Component({
  selector: 'hpm-tabs',
  templateUrl: './tabs.page.html',
  styleUrl: './tabs.page.scss',
  imports: [
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonModal,
    TranslateModule,
    ActingAsBannerComponent,
    RecordPickerComponent,
    MoreSheetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsPage implements AfterViewInit {
  private readonly actingAs = inject(ActingAsService);
  private readonly bootstrap = inject(SessionBootstrapService);
  private readonly modalController = inject(ModalController);
  private readonly data = inject(PortalDataService);
  private readonly moreSheetBus = inject(MoreSheetBus);
  private readonly navController = inject(NavController);
  private readonly backButton = inject(BackButtonService);

  /**
   * The outlet whose per-tab stack the hardware back button pops (§8.4.8).
   *
   * Read off `IonTabs` rather than queried directly: the outlet belongs to Ionic's own template, and the one this
   * file used to declare was a duplicate that covered the app and ate every touch. See tabs.page.html.
   */
  readonly tabsRef = viewChild.required(IonTabs);

  readonly tabs = MOBILE_TABS;
  readonly nav = MOBILE_NAV;

  readonly runCount = this.bootstrap.runCount;

  /** The undismissable fork modal. Driven by the service, never by a click. */
  readonly mustChoose = this.actingAs.mustChoose;

  /** The voluntary switch, opened from the banner. */
  readonly switching = signal(false);

  readonly moreOpen = signal(false);

  /** Which tab is on screen, so its icon can be the filled variant. Set by `ionTabsDidChange`, including on load. */
  readonly activeTab = signal(MOBILE_TABS[0]);

  /** Exposed for the template; see {@link activeIcon}. */
  readonly activeIcon = activeIcon;

  readonly pickerOpen = computed(() => this.mustChoose() || this.switching());

  /** Tab bar buttons, in bar order, with their labels resolved from MOBILE_NAV. */
  readonly tabItems = computed<MobileNavItem[]>(() =>
    this.tabs.map(tab => this.nav.find(item => item.path === tab)).filter((item): item is MobileNavItem => item !== undefined),
  );

  constructor() {
    // A screen's toolbar ⋯ asks; the shell opens. See MoreSheetBus for why it cannot bind directly.
    this.moreSheetBus.opened$.pipe(takeUntilDestroyed()).subscribe(() => this.moreOpen.set(true));

    /**
     * §7.4.4 and §8.4.8: the Android hardware back button must not dismiss `mustChoose`.
     *
     * `[canDismiss]="false"` on the modal covers gesture and backdrop, but Ionic routes hardware
     * back through its own overlay handling, so the modal has to be re-asserted rather than assumed.
     * Registering a high-priority handler while the fork modal is open is what stops back from
     * closing it — and closing it would leave somebody in the portal with no record selected, which
     * is the one state the fork exists to prevent.
     */
    effect(onCleanup => {
      if (!this.mustChoose()) {
        return;
      }
      const block = (event: Event): void => {
        event.preventDefault();
        event.stopPropagation();
      };
      document.addEventListener('ionBackButton', block, { capture: true });
      onCleanup(() => document.removeEventListener('ionBackButton', block, { capture: true }));
    });
  }

  ngAfterViewInit(): void {
    this.backButton.register(this.tabsRef().outlet);
  }

  openSwitch(): void {
    this.switching.set(true);
  }

  /**
   * Switching is the web's `switchRecord()` plus one mobile-only step (§7.4.3).
   */
  /**
   * Back to the patient search.
   *
   * <p>Navigation lives here rather than in the banner for the same reason `openSwitch` does: the
   * shell owns where the shell goes. The finder sits outside the tabs stack, so this leaves it
   * rather than pushing onto a tab — a patient search is not a page within a patient's record.</p>
   */
  openFinder(): void {
    void this.navController.navigateRoot('/finder');
  }

  async onChosen(patientId: string): Promise<void> {
    // Guard against re-selecting the same id: without it, tapping the record you already have open
    // resets every stream and pops every stack for no reason.
    if (patientId === this.actingAs.current()?.patientId) {
      this.switching.set(false);
      return;
    }

    this.actingAs.select(patientId);
    this.switching.set(false);

    /**
     * NOT OPTIONAL (§3.2, §7.4.3). Without it the profile lookup keeps resolving the previous
     * patient and the portal shows one person's record under another's name, with the banner
     * cheerfully naming the wrong one.
     *
     * It is safe to call before the modal closes because §7.5's `startWith(LOADING)` sits inside
     * the switchMap: every one of the twelve streams resets to `loading` on this call, so what
     * appears behind the closing modal is skeletons, never the previous patient's rows.
     */
    this.data.reload();

    /**
     * THE MOBILE-ONLY STEP (§7.4.3), and the web has no equivalent of this bug because it has no
     * per-tab history to leave anything on.
     *
     * Ionic keeps a separate navigation stack per tab. Switching records resets the DATA, but a
     * `case/:id` page belonging to the PREVIOUS patient is still sitting on the Cases stack — and it
     * reappears, fully rendered, the next time that tab is tapped. Under the new patient's banner.
     *
     * `navigateRoot` on the tabs URL unwinds every one of them. Done after `data.reload()` so the
     * roots it lands on are already showing skeletons rather than the old rows.
     */
    await this.navController.navigateRoot('/tabs/overview');

    await this.modalController.dismiss().catch(() => undefined);
  }

  closeMore(): void {
    this.moreOpen.set(false);
  }
}
