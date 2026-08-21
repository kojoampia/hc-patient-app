/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/shared/ui/avatar/avatar.component.ts @ 12e418c
 * Divergence: hpd -> hpm throughout; SharedModule (never copied) replaced by the lifted TranslateDirective.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * A person, as a circle: their photograph if the record has one, their initials if it does not.
 *
 *   <hpm-avatar [name]="member.name" [initials]="member.initials" [imageUrl]="member.imageUrl" [size]="40" />
 *
 * The fallback is the point. The seeded record carries no photographs and a real one often will not
 * either, so the monogram is the normal case rather than the degraded one — which is why it is a
 * filled navy circle rather than a grey placeholder that reads as something failing to load.
 *
 * Decorative by default: the name it stands for is always rendered beside it, so announcing the
 * image as well would have a screen reader say the person twice.
 */
@Component({
  selector: 'hpm-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (imageUrl) {
      <img class="hc-avatar" [class]="sizeClass" [src]="imageUrl" [alt]="name ? '' : null" />
    } @else {
      <span class="hc-monogram" [class]="sizeClass" aria-hidden="true">{{ initials }}</span>
    }
  `,
})
export class AvatarComponent {
  /** Only used to decide whether the image is decorative; the caller renders the name itself. */
  @Input() name = '';
  @Input() initials = '';
  @Input() imageUrl: string | null = null;

  /** One of the sizes `_components.scss` generates: 32, 40, 48, 56, 72. */
  @Input() size: 32 | 40 | 48 | 56 | 72 = 40;

  get sizeClass(): string {
    return `hc-av-${this.size}`;
  }
}
