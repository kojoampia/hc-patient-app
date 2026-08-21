/**
 * New in hc-patient-app.
 *
 * Phase 3 registers the five tab roots so the shell is navigable. Phase 5 replaces each
 * `PlaceholderPage` with its real screen and adds the eight non-root destinations under the tab
 * `TAB_OWNER` assigns them — `emergencies` under overview, `visitations`/`activity`/`allergies`
 * under record, `medications`/`reports`/`plans` under cases.
 *
 * `case/:id` is then registered under ALL FIVE tabs via a `caseRoute()` factory (§8.1). It is
 * linked from eight screens: jumping tabs to open a case would yank the reader out of the list they
 * were scanning, and registering it once above the tab bar would hide the tab bar on the
 * most-visited detail screen in the app. Five copies of one lazy route object is the cheap answer.
 */

import { Type } from '@angular/core';
import { Routes } from '@angular/router';

import { MOBILE_NAV, MOBILE_TABS } from './mobile-nav';

/** Each tab root, labelled from the same MOBILE_NAV entry the tab bar reads. */
/** Tab roots that have a real screen. The rest still render the placeholder until phase 5 finishes. */
const TAB_PAGES: Readonly<Record<string, (() => Promise<Type<unknown>>) | undefined>> = {
  overview: () => import('app/portal/overview/overview.page').then(m => m.OverviewPage),
  cases: () => import('app/portal/cases/cases.page').then(m => m.CasesPage),
  schedules: () => import('app/portal/schedules/schedules.page').then(m => m.SchedulesPage),
  record: () => import('app/portal/record/record.page').then(m => m.RecordPage),
  profile: () => import('app/portal/profile/profile.page').then(m => m.ProfilePage),
};

const tabRoutes: Routes = MOBILE_TABS.map(tab => ({
  path: tab,
  loadComponent: TAB_PAGES[tab]!,
  data: { labelKey: MOBILE_NAV.find(item => item.path === tab)?.labelKey ?? 'patientPortal.nav.overview' },
}));

export const TABS_ROUTES: Routes = [
  ...tabRoutes,
  {
    path: 'medications',
    loadComponent: () => import('app/portal/medications/medications.page').then(m => m.MedicationsPage),
  },
  {
    path: 'reports',
    loadComponent: () => import('app/portal/reports/reports.page').then(m => m.ReportsPage),
  },
  {
    path: 'plans',
    loadComponent: () => import('app/portal/plans/plans.page').then(m => m.PlansPage),
  },
  {
    path: 'case/:id',
    loadComponent: () => import('app/portal/case-detail/case-detail.page').then(m => m.CaseDetailPage),
  },
  {
    path: 'allergies',
    loadComponent: () => import('app/portal/allergies/allergies.page').then(m => m.AllergiesPage),
  },
  {
    path: 'visitations',
    loadComponent: () => import('app/portal/visitations/visitations.page').then(m => m.VisitationsPage),
  },
  {
    path: 'activity',
    loadComponent: () => import('app/portal/activity/activity.page').then(m => m.ActivityPage),
  },
  {
    path: 'emergencies',
    loadComponent: () => import('app/portal/emergencies/emergencies.page').then(m => m.EmergenciesPage),
  },
  {
    path: '',
    redirectTo: 'overview',
    pathMatch: 'full',
  },
];
