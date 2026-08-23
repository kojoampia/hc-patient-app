/**
 * New in hc-patient-app. The web's `onboardingGuard` is the shape reference; the destinations
 * differ because §6 decision 2 replaced the wizard and the invitations screen with dead ends.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, filter, map, take } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

import { SessionBootstrapService } from './session-bootstrap.service';

/**
 * Guards the whole shell. Runs after `UserRouteAccessService`, so by the time it is asked the caller
 * is signed in; the question it answers is different — not "may you be here" but "is there anything
 * here for you".
 *
 * It never decides anything itself. `SessionBootstrapService` owns §3.2 in one place, and this only
 * translates its outcome into a route. Two things deciding where a signed-in person goes is how a
 * redirect loop starts, and the web has the scar to prove it (`onboardingGuard` needs
 * `onboardingCompleteGuard` to exist purely to disagree safely).
 */
export const forkGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const bootstrap = inject(SessionBootstrapService);
  const router = inject(Router);

  // Idempotent: a navigation that arrives while the fork is still running waits for it rather than
  // starting a second one.
  if (!bootstrap.isResolved()) {
    bootstrap.restart();
  }

  return toObservable(bootstrap.outcome).pipe(
    filter(outcome => outcome.kind !== 'pending'),
    take(1),
    map(outcome => {
      switch (outcome.kind) {
        case 'portal':
        case 'must-choose':
          // `must-choose` still enters the shell — the modal is rendered BY the shell and is
          // undismissable, so the portal is behind it but unreachable. Routing elsewhere would mean
          // a second place that knows about the fork.
          return true;

        case 'onboarding-required':
          return router.parseUrl('/onboarding-required');

        case 'invitations-required':
          // §3.2's fourth row. NOT '/onboarding-required'. A PENDING nomination grants nothing, so
          // it does not read as acting for somebody — but sending them to onboarding asks them to
          // create a patient record purely to answer somebody else's nomination.
          return router.parseUrl('/invitations-required');

        case 'finder':
          // An administrator has no record of their own, so there is nothing behind the shell for
          // them until they choose somebody's. Not a dead end: the finder is where they choose.
          return router.parseUrl('/finder');

        case 'failed':
          return router.parseUrl('/fork-failed');

        default:
          return router.parseUrl('/login');
      }
    }),
  );
};
