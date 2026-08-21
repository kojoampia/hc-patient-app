/**
 * Rewritten from hc-patient-dashboard
 *   src/main/webapp/app/shared/ui/empty-state/empty-state.component.ts @ 12e418c
 * Divergence: not a lift. The web's version imports SharedModule (never copied — it exports
 *   NgbModule and FontAwesomeModule) and `hpm-icon`. It uses TranslateModule and an
 *   ionicon instead. Phase 5 lifted the icon set, but this deliberately still uses an ionicon: it
 *   is rendered inside hpm-stream beside Ionic's own skeletons and failure card, so the whole
 *   three-state frame stays in one icon vocabulary. The inputs and the `.hc-empty` class it renders
 *   are the web's, so nothing downstream had to move.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

/**
 * What a list shows when it has nothing in it.
 *
 * Every portal list uses this rather than rendering nothing, because a blank panel and a panel that
 * failed to load look identical, and the patient cannot tell "you have no allergies on file" from
 * "we could not reach the server".
 *
 * That distinction is the whole of §7.5, and this component only owns half of it — the honest empty
 * half. `hpm-stream` owns the other half and decides which of the two to show.
 */
@Component({
  selector: 'hpm-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, TranslateModule],
  template: `
    <div class="hc-empty">
      <ion-icon [name]="icon()" aria-hidden="true"></ion-icon>
      <b>{{ titleKey() | translate }}</b>
      @if (messageKey()) {
        <span>{{ messageKey()! | translate }}</span>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .hc-empty ion-icon {
      font-size: 42px;
      color: var(--hc-grey-400);
    }
  `,
})
export class EmptyStateComponent {
  readonly titleKey = input.required<string>();
  readonly messageKey = input<string>();
  readonly icon = input('file-tray-outline');
}
