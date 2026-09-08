/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/shared/ui/panel/panel.component.ts @ 12e418c
 * Divergence: hpd -> hpm throughout; SharedModule (never copied) replaced by the lifted TranslateDirective.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import TranslateDirective from 'app/shared/language/translate.directive';
import { IconComponent } from 'app/shared/ui/icon/icon.component';
import { IconName } from 'app/shared/ui/icon/icon.constants';

/**
 * A titled panel: cream header strip, body, optional footer.
 *
 *   <hpm-panel titleKey="patientPortal.record.vitals" icon="heart">
 *     …body…
 *     <ng-container hpmPanelActions><button …></ng-container>
 *     <ng-container hpmPanelFoot>…</ng-container>
 *   </hpm-panel>
 */
@Component({
  selector: 'hpm-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, IconComponent],
  template: `
    <section class="hc-panel">
      <header class="hc-panel__head">
        @if (icon) {
          <hpm-icon [name]="icon" [size]="15" />
        }
        <!-- eslint-disable-next-line @angular-eslint/template/elements-content --
             hpmTranslate writes the heading's text content from titleKey at runtime, so the element is
             empty in source and never empty on screen. The rule reads the template, not the directive. -->
        <h4 [hpmTranslate]="titleKey"></h4>
        <ng-content select="[hpmPanelActions]" />
      </header>

      <div class="hc-panel__body" [class.hc-panel__body--pad]="padded">
        <ng-content />
      </div>

      <ng-content select="[hpmPanelFoot]" />
    </section>
  `,
  styles: [
    `
      /* A custom element is inline until told otherwise, and a vertical margin on an inline element
         does nothing at all. Four templates put \`hc-mt-16\` on this component and got no gap for it —
         visible on the allergies screen, where the conditions panel sat flush against the card above
         it and the two read as one block. Everywhere else a grid supplies the spacing, which is why
         it went unnoticed for so long. */
      :host {
        display: block;
      }
    `,
  ],
})
export class PanelComponent {
  @Input({ required: true }) titleKey!: string;
  @Input() icon?: IconName;

  /** Panels that hold prose or a form need padding; panels that hold full-bleed rows do not. */
  @Input() padded = false;
}
