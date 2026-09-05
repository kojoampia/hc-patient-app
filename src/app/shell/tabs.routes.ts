/**
 * New in hc-patient-app.
 *
 * **THE TABLE IS DERIVED FROM `TAB_OWNER`**, and that is the fix for the defect where only the five
 * tab roots were reachable (`docs/backlog.md` item 5). `PortalNavService` resolves `medications` to
 * `/tabs/cases/medications` by reading that map, while this file registered `medications` FLAT, as a
 * sibling of the tab roots — so the nested URL matched nothing, `app.routes.ts`'s `**` redirect sent
 * it to `tabs/overview`, and a real, populated Overview rendered. Nothing failed; that is why four
 * months of screenshots were taken off five screens.
 *
 * Deriving the children from the same constant the service resolves against is what stops the two
 * disagreeing again. Moving a screen between tabs stays the one-line change §8.1 promises: edit
 * `TAB_OWNER`, and both the URL and the route that answers it move together.
 *
 * `case/:id` is registered under ALL FIVE tabs via {@link caseRoute} (§8.1). It is linked from eight
 * screens: jumping tabs to open a case would yank the reader out of the list they were scanning, and
 * registering it once above the tab bar would hide the tab bar on the most-visited detail screen in
 * the app. Five copies of one lazy route object is the cheap answer.
 */

import { Type } from '@angular/core';
import { Route, Routes } from '@angular/router';

import { MOBILE_NAV, MOBILE_TABS, TAB_OWNER } from './mobile-nav';

/**
 * Every portal screen that has a route of its own, keyed by the path `TAB_OWNER` names it with.
 *
 * Thirteen entries for §8.1's thirteen routes: the five tab roots, the eight destinations that live
 * on somebody's stack, and `case/:id` — which is not here because it is not in `TAB_OWNER` either.
 * See {@link caseRoute}.
 */
const PORTAL_PAGES: Readonly<Record<string, (() => Promise<Type<unknown>>) | undefined>> = {
  overview: () => import('app/portal/overview/overview.page').then(m => m.OverviewPage),
  cases: () => import('app/portal/cases/cases.page').then(m => m.CasesPage),
  schedules: () => import('app/portal/schedules/schedules.page').then(m => m.SchedulesPage),
  record: () => import('app/portal/record/record.page').then(m => m.RecordPage),
  profile: () => import('app/portal/profile/profile.page').then(m => m.ProfilePage),

  medications: () => import('app/portal/medications/medications.page').then(m => m.MedicationsPage),
  reports: () => import('app/portal/reports/reports.page').then(m => m.ReportsPage),
  plans: () => import('app/portal/plans/plans.page').then(m => m.PlansPage),
  allergies: () => import('app/portal/allergies/allergies.page').then(m => m.AllergiesPage),
  visitations: () => import('app/portal/visitations/visitations.page').then(m => m.VisitationsPage),
  activity: () => import('app/portal/activity/activity.page').then(m => m.ActivityPage),
  emergencies: () => import('app/portal/emergencies/emergencies.page').then(m => m.EmergenciesPage),

  /*
   * Deliberately NOT in MOBILE_NAV, so it appears in neither the tab bar nor the More sheet. It is
   * reached from the profile screen, which is a tab root — one tap from anywhere, and not sitting
   * in a list beside "Activity" where a destructive path has no business being. `TAB_OWNER` still
   * names it, which is what puts it on the profile stack at `/tabs/profile/delete-account`.
   *
   * It is still a real route rather than a modal, because Google Play's reviewer has to be able to
   * FIND it: "we could not locate the account deletion option" is a standard rejection, and a
   * screen with an address can be named in the review notes.
   */
  'delete-account': () => import('app/portal/account/account-deletion.page').then(m => m.AccountDeletionPage),
};

/**
 * The component for a portal path, or a loud failure.
 *
 * A route with no `loadComponent` is neither a build error nor a runtime one: Angular treats it as a
 * componentless route and renders nothing at all — the same silent nothing this file's own defect
 * produced. A path named in `TAB_OWNER` with no page behind it fails here, while the table is being
 * built, rather than on the handset of whoever taps it.
 */
function pageFor(path: string): () => Promise<Type<unknown>> {
  const page = PORTAL_PAGES[path];
  if (!page) {
    throw new Error(`tabs.routes: no page for portal path "${path}" — add it to PORTAL_PAGES or drop it from TAB_OWNER`);
  }
  return page;
}

/** The screens `TAB_OWNER` puts on one tab's stack, the tab root itself excluded — it is the `''` child. */
function stackOf(tab: string): Routes {
  return Object.keys(TAB_OWNER)
    .filter(path => path !== tab && TAB_OWNER[path] === tab)
    .map(path => ({ path, loadComponent: pageFor(path) }));
}

/**
 * One copy of the case detail route, for one tab's stack.
 *
 * A factory rather than a shared constant because each copy is a distinct route object in a distinct
 * children array; Angular does not mind sharing one, but a shared object invites somebody to mutate
 * it and change five tabs at once.
 */
function caseRoute(): Route {
  return {
    path: 'case/:id',
    loadComponent: () => import('app/portal/case-detail/case-detail.page').then(m => m.CaseDetailPage),
  };
}

/**
 * Each tab is a parent path with the tab root as its `''` child, so `/tabs/cases` renders Cases and
 * `/tabs/cases/medications` renders Medications with the Cases tab still selected.
 *
 * Nesting rather than flattening is load-bearing for the tab bar as well as for the URL: Ionic reads
 * the stack id off the FIRST segment after `/tabs` (`computeStackId`), so a screen registered under
 * its owning tab joins that tab's own navigation stack — which is what makes the back gesture return
 * to the list the reader came from, and what keeps the right tab highlighted while they are on it.
 */
const tabRoutes: Routes = MOBILE_TABS.map(tab => ({
  path: tab,
  children: [
    {
      path: '',
      loadComponent: pageFor(tab),
      data: { labelKey: MOBILE_NAV.find(item => item.path === tab)?.labelKey ?? 'patientPortal.nav.overview' },
    },
    ...stackOf(tab),
    caseRoute(),
  ],
}));

export const TABS_ROUTES: Routes = [
  ...tabRoutes,
  {
    path: '',
    redirectTo: 'overview',
    pathMatch: 'full',
  },
];
