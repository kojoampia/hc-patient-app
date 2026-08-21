import { Routes } from '@angular/router';

import { UserRouteAccessService } from 'app/core/auth/user-route-access.service';
import { forkGuard } from 'app/fork/fork.guard';

/**
 * §8.2's route table.
 *
 * ```
 * ''                      → redirect /tabs/overview
 * 'login'                 LoginPage                 no shell
 * 'lock'                  LockPage                  no shell, canDismiss:false     ← phase 6
 * 'onboarding-required'   dead end                  guarded, no shell
 * 'invitations-required'  dead end                  guarded, no shell
 * 'tabs'                  TabsPage                  canActivate: [UserRouteAccessService, forkGuard]
 * ```
 *
 * The two dead ends and `fork-failed` sit OUTSIDE the shell deliberately: each of them is a state
 * where there is no record to show, so rendering the tab bar and the acting-as banner around them
 * would frame an empty portal as a working one.
 *
 * Guard ORDER on `tabs` is load-bearing. `UserRouteAccessService` answers "may you be here" and
 * redirects to /login; only then does `forkGuard` ask "is there anything here for you". Reversed,
 * the fork would fire `/care-delegations/mine` without a token and every signed-out visitor would
 * land on the failure screen instead of the sign-in one.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('app/auth/login/login.page').then(m => m.LoginPage),
  },

  {
    /**
     * Outside the shell, and deliberately NOT guarded by forkGuard: the fork needs a token, and
     * being locked is precisely the state of having one that is not in memory. §8.2.
     */
    path: 'lock',
    loadComponent: () => import('app/auth/lock/lock.page').then(m => m.LockPage),
  },

  {
    path: 'tabs',
    canActivate: [UserRouteAccessService, forkGuard],
    loadComponent: () => import('app/shell/tabs.page').then(m => m.TabsPage),
    loadChildren: () => import('app/shell/tabs.routes').then(m => m.TABS_ROUTES),
  },

  {
    path: 'onboarding-required',
    canActivate: [UserRouteAccessService],
    loadComponent: () => import('app/deadends/dead-end.page').then(m => m.DeadEndPage),
    data: { kind: 'onboarding' },
  },
  {
    // NOT the same screen as onboarding-required, and §3.2's fourth row is entirely about the
    // difference. A PENDING nominee sent to onboarding is asked to create a patient record purely
    // to answer somebody else's nomination.
    path: 'invitations-required',
    canActivate: [UserRouteAccessService],
    loadComponent: () => import('app/deadends/dead-end.page').then(m => m.DeadEndPage),
    data: { kind: 'invitations' },
  },

  {
    path: 'fork-failed',
    canActivate: [UserRouteAccessService],
    loadComponent: () => import('app/fork/fork-failed.page').then(m => m.ForkFailedPage),
  },

  {
    path: '',
    redirectTo: 'tabs/overview',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'tabs/overview',
  },
];
