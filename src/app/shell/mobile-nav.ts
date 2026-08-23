/**
 * New in hc-patient-app — replaces `layouts/shell/shell-nav.ts` (patient-mobile.md §8.1).
 *
 * Keeps the web's five tabs, its ten nav items in the same order, and **the same i18n keys**, so
 * neither repo needs new translations and the merge gate stays green. `NAV_OWNER` is extended into
 * `TAB_OWNER`, which has to answer for all thirteen screens rather than the web's three exceptions.
 *
 * The icons are ionicons rather than the web's `IconName`. The tab bar and the More sheet are Ionic
 * chrome; the lifted `hpm-icon` set is for page content and arrives in phase 5.
 */

/** One destination in the portal. */
export interface MobileNavItem {
  /** Route path, relative to the tab it lives on. */
  readonly path: string;
  /** Translation key for the label — identical to the web's. */
  readonly labelKey: string;
  /** Shorter label for the tab bar, where the full one will not fit. */
  readonly shortLabelKey?: string;
  /** ionicons name, outline variant. */
  readonly icon: string;
  /** Translation key for the group heading in the More sheet. */
  readonly groupKey: string;
}

/**
 * The five tab roots, in bar order.
 *
 * FIVE TABS CANNOT REACH TEN DESTINATIONS — see {@link MOBILE_NAV} and the More sheet.
 */
export const MOBILE_TABS: readonly string[] = ['overview', 'record', 'schedules', 'cases', 'profile'];

/**
 * All ten destinations, in the web's own display order, with the web's own grouping — health,
 * clinical, account. That grouping is the sidebar's, not a fresh opinion, so somebody who uses both
 * clients finds the same things in the same order.
 */
export const MOBILE_NAV: readonly MobileNavItem[] = [
  { path: 'overview', labelKey: 'patientPortal.nav.overview', icon: 'home-outline', groupKey: 'patientPortal.nav.group.health' },
  {
    path: 'record',
    labelKey: 'patientPortal.nav.record',
    shortLabelKey: 'patientPortal.nav.recordShort',
    icon: 'folder-outline',
    groupKey: 'patientPortal.nav.group.health',
  },
  {
    path: 'schedules',
    labelKey: 'patientPortal.nav.schedules',
    shortLabelKey: 'patientPortal.nav.schedulesShort',
    icon: 'calendar-outline',
    groupKey: 'patientPortal.nav.group.health',
  },
  {
    path: 'emergencies',
    labelKey: 'patientPortal.nav.emergencies',
    icon: 'alert-circle-outline',
    groupKey: 'patientPortal.nav.group.health',
  },
  {
    path: 'visitations',
    labelKey: 'patientPortal.nav.visitations',
    icon: 'location-outline',
    groupKey: 'patientPortal.nav.group.health',
  },
  { path: 'cases', labelKey: 'patientPortal.nav.cases', icon: 'briefcase-outline', groupKey: 'patientPortal.nav.group.clinical' },
  {
    path: 'medications',
    labelKey: 'patientPortal.nav.medications',
    icon: 'medkit-outline',
    groupKey: 'patientPortal.nav.group.clinical',
  },
  {
    path: 'reports',
    labelKey: 'patientPortal.nav.reports',
    icon: 'document-text-outline',
    groupKey: 'patientPortal.nav.group.clinical',
  },
  { path: 'plans', labelKey: 'patientPortal.nav.plans', icon: 'leaf-outline', groupKey: 'patientPortal.nav.group.clinical' },
  {
    path: 'allergies',
    labelKey: 'patientPortal.nav.allergies',
    icon: 'shield-outline',
    groupKey: 'patientPortal.nav.group.clinical',
  },
  { path: 'activity', labelKey: 'patientPortal.nav.activity', icon: 'time-outline', groupKey: 'patientPortal.nav.group.account' },
  { path: 'profile', labelKey: 'patientPortal.nav.profile', icon: 'person-outline', groupKey: 'patientPortal.nav.group.account' },
];

/**
 * Which tab stack owns each screen.
 *
 * The web's `NAV_OWNER` only names its three exceptions; this has to answer for all thirteen
 * screens, because it is what `PortalNavService` resolves against and what decides which tab
 * highlights.
 *
 * **`allergies` under `record` is the one judgement call** (§8.1). On a phone it reads as record
 * content, and — the deciding reason — **no screen links to it**: it is sidebar-only on the web. A
 * destination with no parent needs an explicit home or it has none, which is exactly how the web
 * ended up with two screens routed and unreachable for months.
 */
/*
 * `string | undefined` rather than `string`, matching the web's own NAV_OWNER declaration. Without
 * `noUncheckedIndexedAccess`, TypeScript types a Record index access as always-present, so the
 * `?? fallback` in tabOwnerOf() below reads as dead code to the type checker while being the
 * load-bearing branch at runtime — every path NOT in this map takes it.
 */
export const TAB_OWNER: Readonly<Record<string, string | undefined>> = {
  overview: 'overview',
  emergencies: 'overview',

  record: 'record',
  visitations: 'record',
  activity: 'record',
  allergies: 'record',

  schedules: 'schedules',

  cases: 'cases',
  medications: 'cases',
  reports: 'cases',
  plans: 'cases',

  profile: 'profile',
};

/**
 * Resolves the tab that should read as active for a portal path.
 *
 * `case/:id` is deliberately absent from {@link TAB_OWNER}: it is registered under ALL FIVE tabs via
 * a `caseRoute()` factory (§8.1), so its owner is whichever tab the reader opened it from. Falling
 * back to the current tab rather than to a fixed one is what stops a case detail yanking somebody
 * out of the list they were scanning.
 */
export function tabOwnerOf(path: string, fallback = 'overview'): string {
  const head: string | undefined = path.split('/').filter(Boolean)[0];
  if (!head) {
    return 'overview';
  }
  return TAB_OWNER[head] ?? fallback;
}
