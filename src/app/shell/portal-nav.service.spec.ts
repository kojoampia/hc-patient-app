import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { NavController } from '@ionic/angular';

import { routes } from 'app/app.routes';
import { MOBILE_NAV, MOBILE_TABS } from './mobile-nav';
import { PortalNavService } from './portal-nav.service';

/**
 * Where every portal destination goes, and whether anything answers when it gets there.
 *
 * <p>There was no spec over this file until `docs/backlog.md` item 5, and the defect it missed is the
 * reason the second half of this one exists. `PortalNavService` resolved `medications` to
 * `/tabs/cases/medications` — correctly, by `TAB_OWNER` — while `tabs.routes.ts` registered
 * `medications` as a sibling of the tab roots, so the URL matched nothing and `app.routes.ts`'s `**`
 * redirect served Overview instead. **A unit test over `urlFor` alone would have passed**: the URL
 * it produced was the intended one. Only asking the router whether that URL resolves catches it.</p>
 *
 * <p>So the second block navigates the REAL route table — `app/app.routes` with `tabs.routes`
 * lazily behind it, exactly as the app declares them. The only edit is the guards, stripped below:
 * `UserRouteAccessService` and `forkGuard` answer "may you be here" and "is there anything here for
 * you", and neither has anything to say about whether a path is registered.</p>
 */

/** Where each `MOBILE_NAV` destination must land. Written out rather than derived from `TAB_OWNER`, which is what the service reads — a table computed the same way as the code cannot disagree with it. */
const EXPECTED_URL: Readonly<Record<string, string>> = {
  overview: '/tabs/overview',
  record: '/tabs/record',
  schedules: '/tabs/schedules',
  emergencies: '/tabs/overview/emergencies',
  visitations: '/tabs/record/visitations',
  cases: '/tabs/cases',
  medications: '/tabs/cases/medications',
  reports: '/tabs/cases/reports',
  plans: '/tabs/cases/plans',
  allergies: '/tabs/record/allergies',
  activity: '/tabs/record/activity',
  profile: '/tabs/profile',
};

/** Not a `MOBILE_NAV` entry — reached from the profile screen — but a destination all the same. */
const DELETE_ACCOUNT_URL = '/tabs/profile/delete-account';

/**
 * Guards removed, everything else — paths, nesting, redirects, the `**` catch-all — left as the app
 * declares it. Recursive over `children`; `loadChildren` is untouched and loads the real
 * `TABS_ROUTES`.
 */
function withoutGuards(table: Routes): Routes {
  return table.map(route => {
    const copy = { ...route };
    delete copy.canActivate;
    delete copy.canActivateChild;
    delete copy.canMatch;
    if (copy.children) {
      copy.children = withoutGuards(copy.children);
    }
    return copy;
  });
}

describe('PortalNavService', () => {
  let service: PortalNavService;
  let nav: { navigateForward: jest.Mock; navigateRoot: jest.Mock };

  beforeEach(() => {
    nav = { navigateForward: jest.fn(() => Promise.resolve(true)), navigateRoot: jest.fn(() => Promise.resolve(true)) };

    TestBed.configureTestingModule({
      providers: [provideRouter(withoutGuards(routes)), provideLocationMocks(), { provide: NavController, useValue: nav }],
    });

    service = TestBed.inject(PortalNavService);
  });

  describe('resolving a destination', () => {
    it('covers every MOBILE_NAV destination, so a new one cannot be added untested', () => {
      expect([...MOBILE_NAV.map(item => item.path)].sort()).toEqual(Object.keys(EXPECTED_URL).sort());
    });

    it.each(Object.entries(EXPECTED_URL))('resolves %s to %s', (path, url) => {
      expect(service.urlFor(path)).toBe(url);
    });

    it('resolves delete-account onto the profile stack', () => {
      expect(service.urlFor('delete-account')).toBe(DELETE_ACCOUNT_URL);
    });

    /** A tab root addresses itself: `/tabs/cases/cases` would be a second history entry for the screen the reader is already on. */
    it.each([...MOBILE_TABS])('addresses the %s tab root as itself', tab => {
      expect(service.urlFor(tab)).toBe(`/tabs/${tab}`);
    });

    /** `case/:id` has no owner of its own — it belongs to whichever tab the reader opened it from. */
    it.each([...MOBILE_TABS])('keeps a case detail on the %s stack it was opened from', tab => {
      expect(service.urlFor('case/c-1', tab)).toBe(`/tabs/${tab}/case/c-1`);
    });

    it('navigates forward to the URL it resolved', async () => {
      await service.go('medications');
      expect(nav.navigateForward).toHaveBeenCalledWith('/tabs/cases/medications');
    });

    it('switches tabs without stacking history', async () => {
      await service.goRoot('cases');
      expect(nav.navigateRoot).toHaveBeenCalledWith('/tabs/cases');
    });
  });

  /**
   * The half that catches item 5.
   *
   * A destination that resolves to nothing is not an error anywhere: the `**` route redirects it to
   * `tabs/overview`, which renders a real, populated screen. `router.url` after the navigation is
   * therefore the whole signal — it is the URL asked for when a route answered, and `/tabs/overview`
   * when the catch-all did.
   */
  describe('against the real route table', () => {
    async function resolve(url: string): Promise<string> {
      await TestBed.inject(Router).navigateByUrl(url);
      return TestBed.inject(Router).url;
    }

    it.each(Object.values(EXPECTED_URL))('%s is registered', async url => {
      await expect(resolve(url)).resolves.toBe(url);
    });

    it('registers delete-account on the profile stack', async () => {
      await expect(resolve(DELETE_ACCOUNT_URL)).resolves.toBe(DELETE_ACCOUNT_URL);
    });

    /** §8.1: registered under all five tabs, because it is linked from eight screens and must not move the reader out of the list they were scanning. */
    it.each([...MOBILE_TABS])('registers case/:id under the %s tab', async tab => {
      await expect(resolve(`/tabs/${tab}/case/c-1`)).resolves.toBe(`/tabs/${tab}/case/c-1`);
    });

    /**
     * What the case detail's back button reads. `case/:id` is on all five stacks, so a fixed
     * `/tabs/cases` — which is what the header carried — moves a reader who opened a case from
     * Record or Overview into a tab they were not in.
     */
    it.each([...MOBILE_TABS])('names the %s tab root while a case is open on that stack', async tab => {
      await resolve(`/tabs/${tab}/case/c-1`);
      expect(service.currentTabRoot('cases')).toBe(`/tabs/${tab}`);
    });

    it('falls back when the reader is outside the shell', async () => {
      await resolve('/login');
      expect(service.currentTabRoot('cases')).toBe('/tabs/cases');
    });

    /**
     * Guards the guard. Every assertion above is "the URL survived the navigation", which would also
     * be true of a route table that resolved everything — so this proves the wildcard is still there
     * and that landing on Overview is what a missing route looks like. It is exactly the shape all
     * nine non-tab destinations had before item 5 was fixed.
     */
    it('sends an unregistered destination to Overview, which is why the defect was invisible', async () => {
      await expect(resolve('/tabs/cases/no-such-screen')).resolves.toBe('/tabs/overview');
    });
  });
});
