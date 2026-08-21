/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/shared/ui/icon/icon.component.ts @ 12e418c
 * Divergence: hpd -> hpm throughout; SharedModule (never copied) replaced by the lifted TranslateDirective.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { ICON_PATHS, IconName } from './icon.constants';

/** Sanitised markup, memoised per (name, strokeWidth). The set is small and entirely static. */
const CACHE = new Map<string, SafeHtml>();

/**
 * Renders one icon from the portal's set.
 *
 *   <hpm-icon name="heart" />
 *   <hpm-icon name="alert" [size]="14" label="Urgent" />
 *
 * Icons are decorative by default and hidden from assistive technology. Pass `label` only when
 * the icon is the sole carrier of meaning — an icon-only button, for instance.
 */
@Component({
  selector: 'hpm-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="hpm-icon"
    [style.width.px]="size"
    [style.height.px]="size"
    [attr.role]="label ? 'img' : null"
    [attr.aria-label]="label ?? null"
    [attr.aria-hidden]="label ? null : 'true'"
    [innerHTML]="svg"
  ></span>`,
  styles: [
    `
      .hpm-icon {
        display: inline-flex;
        flex: none;
      }

      .hpm-icon ::ng-deep svg {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private iconName: IconName = 'home';
  private stroke = 1.9;

  /** Rendered box in px. The geometry is a 24-unit square, so this scales uniformly. */
  @Input() size = 18;

  /** Accessible name. Omit for decorative icons, which are then hidden from screen readers. */
  @Input() label?: string;

  svg: SafeHtml;

  constructor() {
    this.svg = this.render();
  }

  @Input({ required: true })
  set name(value: IconName) {
    this.iconName = value;
    this.svg = this.render();
  }

  @Input()
  set strokeWidth(value: number) {
    this.stroke = value;
    this.svg = this.render();
  }

  private render(): SafeHtml {
    const key = `${this.iconName}:${this.stroke}`;
    const cached = CACHE.get(key);
    if (cached) {
      return cached;
    }

    // bypassSecurityTrustHtml is safe here and only here: the interpolated geometry comes from
    // ICON_PATHS, a compile-time constant map. Never widen this to accept an arbitrary string.
    const markup = this.sanitizer.bypassSecurityTrustHtml(
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${this.stroke}" ` +
        `stroke-linecap="round" stroke-linejoin="round" focusable="false">${ICON_PATHS[this.iconName]}</svg>`,
    );
    CACHE.set(key, markup);
    return markup;
  }
}
