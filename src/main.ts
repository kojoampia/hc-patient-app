import { bootstrapApplication } from '@angular/platform-browser';
import { addIcons } from 'ionicons';
import { checkmarkOutline, chevronBack, cloudOfflineOutline, ellipsisHorizontal, lockClosed } from 'ionicons/icons';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

/**
 * Every icon the app names, registered by hand.
 *
 * <p>Without this an `ion-icon` goes looking for its SVG over HTTP, relative to the document — and the document
 * here is served from a Capacitor scheme that `new URL()` will not take as a base, so the lookup throws
 * `Failed to construct 'URL': Invalid base URL` and the icon renders as an empty box. Nothing else breaks, which
 * is why it survived: the icons that were missing are `slot="icon-only"`, so the overflow button on every portal
 * page was a blank square that still worked if you guessed it was there.</p>
 *
 * <p>The alternative — copying `node_modules/ionicons/dist/ionicons/svg` into the build assets — ships about
 * 1,300 files to serve five and still costs a request each. Adding an icon to a template means adding it here;
 * the failure if you forget is visible on the screen you are working on.</p>
 */
addIcons({
  'checkmark-outline': checkmarkOutline,
  'chevron-back': chevronBack,
  'cloud-offline-outline': cloudOfflineOutline,
  'ellipsis-horizontal': ellipsisHorizontal,
  'lock-closed': lockClosed,
});

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
  // Nothing has rendered at this point, so there is no in-app surface to report on. A telemetry
  // exporter throwing during module evaluation once took the patient SPA down for ~12 minutes while
  // every curl and health check returned 200 — leaving this silent is how that happens again.
  console.error('Bootstrap failed', error);
});
