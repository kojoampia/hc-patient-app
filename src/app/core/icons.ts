/**
 * New in hc-patient-app. The web has no equivalent: it serves its own icon font from the same origin, and the
 * question of registering anything never arises there.
 *
 * <h2>Why this file exists at all</h2>
 *
 * <p>An `ion-icon` that has not been registered goes looking for its SVG over HTTP, relative to the document. The
 * document here is served from a Capacitor scheme that `new URL()` will not accept as a base, so the lookup throws
 * `Failed to construct 'URL': Invalid base URL` and the icon renders as an empty box. Nothing else breaks — which
 * is exactly why it shipped: the tab bar had six labels and no pictures, and it still worked.</p>
 *
 * <p>The alternative is copying `node_modules/ionicons/dist/ionicons/svg` into the build assets — about 1,300 files
 * to serve the two dozen below, plus a request each at runtime. Registering by hand is cheaper and tree-shakes.</p>
 *
 * <h2>The rule</h2>
 *
 * <p><b>Every `ion-icon` name used anywhere in the app must appear here.</b> `icons.spec.ts` reads the source tree
 * and fails if one does not, because the first attempt at this file was written from a grep for `name="…"` and so
 * missed every icon bound through `[name]` or passed as an input — which was most of them, including the whole tab
 * bar. A list maintained by hand needs something that notices when it falls behind.</p>
 *
 * <p>The five bare names are the filled counterparts of the five tab icons, used for the tab you are on — see
 * `activeIcon` in shell/mobile-nav.ts.</p>
 *
 * <p>Icons drawn by `hpm-icon` are a different set entirely and are not registered here; that component inlines its
 * own SVG paths and never touches ionicons.</p>
 */

import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  briefcase,
  briefcaseOutline,
  calendar,
  calendarOutline,
  cardOutline,
  checkmarkOutline,
  chevronBack,
  clipboardOutline,
  cloudOfflineOutline,
  documentTextOutline,
  ellipsisHorizontal,
  fileTrayOutline,
  folder,
  folderOutline,
  home,
  homeOutline,
  hourglassOutline,
  leafOutline,
  locationOutline,
  lockClosed,
  mailOpenOutline,
  medkitOutline,
  peopleOutline,
  person,
  personOutline,
  pulseOutline,
  shieldOutline,
  timeOutline,
} from 'ionicons/icons';

/** Keyed by the name templates use, not by the export name — `addIcons` registers whatever key it is given. */
export const APP_ICONS: Readonly<Record<string, string>> = {
  'alert-circle-outline': alertCircleOutline,
  briefcase,
  'briefcase-outline': briefcaseOutline,
  calendar,
  'calendar-outline': calendarOutline,
  'card-outline': cardOutline,
  'checkmark-outline': checkmarkOutline,
  'chevron-back': chevronBack,
  'clipboard-outline': clipboardOutline,
  'cloud-offline-outline': cloudOfflineOutline,
  'document-text-outline': documentTextOutline,
  'ellipsis-horizontal': ellipsisHorizontal,
  'file-tray-outline': fileTrayOutline,
  folder,
  'folder-outline': folderOutline,
  home,
  'home-outline': homeOutline,
  'hourglass-outline': hourglassOutline,
  'leaf-outline': leafOutline,
  'location-outline': locationOutline,
  'lock-closed': lockClosed,
  'mail-open-outline': mailOpenOutline,
  'medkit-outline': medkitOutline,
  'people-outline': peopleOutline,
  person,
  'person-outline': personOutline,
  'pulse-outline': pulseOutline,
  'shield-outline': shieldOutline,
  'time-outline': timeOutline,
};

export function registerAppIcons(): void {
  addIcons(APP_ICONS);
}
