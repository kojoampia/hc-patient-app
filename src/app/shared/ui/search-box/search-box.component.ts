/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/shared/ui/search-box/search-box.component.ts @ 12e418c
 * Divergence: hpd -> hpm throughout; SharedModule (never copied) replaced by the lifted TranslateDirective.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from 'app/shared/ui/icon/icon.component';

/**
 * The rounded search field used above every portal list.
 *
 * Emits on each keystroke: the lists it filters are already in memory, so debouncing would only
 * add lag. If a list ever moves to a server-side query, debounce there, not here.
 */
@Component({
  selector: 'hpm-search-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, IconComponent],
  template: `
    <div class="hc-search">
      <hpm-icon name="search" [size]="16" />
      <input
        type="search"
        autocomplete="off"
        [id]="inputId"
        [value]="value"
        [placeholder]="placeholderKey | translate"
        [attr.aria-label]="placeholderKey | translate"
        (input)="queryChange.emit($any($event.target).value)"
      />
    </div>
  `,
})
export class SearchBoxComponent {
  @Input({ required: true }) inputId!: string;
  @Input({ required: true }) placeholderKey!: string;
  @Input() value = '';

  @Output() readonly queryChange = new EventEmitter<string>();
}
