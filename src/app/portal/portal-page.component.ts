/**
 * New in hc-patient-app — no origin in the web repo, which has one shell around a router outlet and
 * no per-screen frame at all.
 *
 * THE FRAME EVERY ONE OF THE THIRTEEN SCREENS WEARS. Phase 5's done-when says each ships "an
 * ion-refresher, a More-sheet entry, and loading/empty/failed specs". Written thirteen times, that
 * is thirteen chances for one screen to forget the refresher or word its failure differently — the
 * same argument §7.5 makes for `hpm-stream`, one level up.
 *
 * So the frame is a component and the screen supplies only its content. What it owns:
 *
 *   - the `ion-header` with the screen's translated title and the ⋯ that opens the More sheet
 *   - the `ion-refresher`, wired to reload and to complete when the data settles
 *   - the `ion-content` and its padding
 *
 * What it deliberately does NOT own: the three states. Those belong to `hpm-stream`, per stream,
 * because a screen can have several — the overview has twelve — and a page-level state would have to
 * pick one to believe.
 */

import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { PortalDataService } from 'app/portal/data/portal-data.service';
import { MoreSheetBus } from 'app/shell/more-sheet.bus';

@Component({
  selector: 'hpm-portal-page',
  templateUrl: './portal-page.component.html',
  styleUrl: './portal-page.component.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    TranslateModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalPageComponent {
  private readonly data = inject(PortalDataService);
  private readonly moreSheet = inject(MoreSheetBus);

  /** Translation key for the screen title — the same key the tab bar and More sheet use. */
  readonly titleKey = input.required<string>();

  /** Set on a detail screen, which has somewhere to go back to. */
  readonly backHref = input<string>();

  /**
   * Emitted after the refresher has asked for a reload, for screens holding state of their own
   * (a search term, a filter) that should survive a pull but a page reload should not.
   */
  readonly refreshed = output<void>();

  openMore(): void {
    this.moreSheet.open();
  }

  /**
   * Pull to refresh.
   *
   * `complete()` runs on a timer rather than when the data lands, and that is a deliberate
   * simplification worth naming: the streams are per-collection and a screen may hold several, so
   * "the data landed" has no single answer here. Waiting on one of them would leave the spinner
   * turning while another was still in flight, or stop it early — both worse than a fixed, short
   * spinner that hands control back while `hpm-stream`'s skeletons carry on showing the real state.
   */
  async refresh(event: RefresherCustomEvent): Promise<void> {
    this.data.reload();
    this.refreshed.emit();
    await new Promise(resolve => setTimeout(resolve, 400));
    await event.target.complete();
  }
}
