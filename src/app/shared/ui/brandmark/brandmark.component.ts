/**
 * New in hc-patient-app — no origin in the web repo, whose shell carries its own header.
 *
 * The Abofonsa BridgeCare seal, for the screens that sit OUTSIDE the portal shell: sign-in, the
 * lock, and both dead ends. Those are the moments a patient is looking at the app rather than at
 * their record, and the only places the brand has room to be itself.
 *
 * It is one component rather than an `<img>` on four screens because the asset needs the same two
 * corrections everywhere, and forgetting either looks like a mistake:
 *
 *   1. `brand.png` is RGB with NO alpha channel, so its corners are opaque white. On the cream
 *      background that is a white square with a circle drawn inside it. `border-radius: 50%` clips
 *      the corners away — the seal is a circle inscribed in the square, so none of the artwork is
 *      lost.
 *   2. It is decorative here: every screen that uses it also states the product in text, so the
 *      image is aria-hidden with an empty alt. Announcing "Abofonsa BridgeCare logo" before a
 *      heading that already says Abofonsa BridgeCare is noise to a screen reader.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'hpm-brandmark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      class="hpm-brandmark__img"
      src="assets/brand/abofonsa-bridgecare.png"
      alt=""
      aria-hidden="true"
      [style.width.px]="size()"
      [style.height.px]="size()"
    />
  `,
  styles: `
    :host {
      display: block;
      text-align: center;
    }

    .hpm-brandmark__img {
      /* Clips the asset's opaque white corners — see the class comment. */
      display: inline-block;
      max-width: 100%;
      border-radius: 50%;
    }
  `,
})
export class BrandmarkComponent {
  /** Rendered size in px. The seal is square, so this is width and height. */
  readonly size = input(112);
}
