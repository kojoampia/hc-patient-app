/**
 * New in hc-patient-app — no origin in the web repo, where this logic is spread across
 * `onboardingGuard`, `LoginService` and the shell.
 *
 * §3.2 IN ONE PLACE. Every client of this backend has the same five-case fork to handle, and the
 * plan is explicit that it must be implemented in full even though §6 decision 2 drops the wizard:
 * dropping the wizard does not drop the question of where an un-onboarded user goes.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, switchMap } from 'rxjs';

import { ActingAsService } from 'app/core/auth/acting-as.service';
import { AccountService } from 'app/core/auth/account.service';
import { Authority } from 'app/config/authority.constants';
import { CareDelegationService, MineResponse, toActingAsChoices } from 'app/portal/data/care-delegation.service';
import { OnboardingStatusService } from 'app/onboarding/onboarding-status.service';

/**
 * Where the fork decided the session should go.
 *
 * `failed` is a state the web does not have, and adding it is a deliberate divergence — see
 * {@link SessionBootstrapService.restart}.
 */
export type ForkOutcome =
  | { kind: 'pending' }
  | { kind: 'portal' }
  | { kind: 'must-choose' }
  | { kind: 'onboarding-required' }
  | { kind: 'invitations-required' }
  | { kind: 'finder' }
  | { kind: 'failed'; status: number | null };

@Injectable({ providedIn: 'root' })
export class SessionBootstrapService {
  private readonly careDelegations = inject(CareDelegationService);
  private readonly onboardingStatus = inject(OnboardingStatusService);
  private readonly actingAs = inject(ActingAsService);
  private readonly account = inject(AccountService);

  private readonly state = signal<ForkOutcome>({ kind: 'pending' });

  /**
   * Bumped after every completed fork run.
   *
   * §6 decision 4's consequence: an angel holding exactly one delegation is auto-selected on every
   * cold start, so the banner's string does not change and its `role="status"` will NOT re-announce
   * it. The banner watches this counter and re-announces explicitly. Without it, the one user who
   * most needs telling whose record is open is the one who is never told.
   *
   * Declared with the other private fields per the member-ordering rule — `inject()` runs in
   * field-initialiser order.
   */
  private readonly runs = signal(0);

  readonly outcome = this.state.asReadonly();
  readonly isResolved = computed(() => this.state().kind !== 'pending');
  readonly runCount = this.runs.asReadonly();

  /**
   * Forgets where the last session was sent, so the next one is decided by asking rather than by
   * remembering.
   *
   * <p><b>This is what stops a failed fork becoming permanent.</b> The outcome lives in a root
   * singleton, and `forkGuard` only re-runs the fork `if (!isResolved())` — deliberately, so that a
   * navigation arriving mid-run waits rather than starting a second one. The cost of that, unnoticed
   * until a physical device found it, is that <em>any</em> resolved outcome decides every later
   * session too, without a single further request.</p>
   *
   * <p>The failure that matters is `failed`, because the fork can legitimately fail when there is no
   * token to make its call with: {@link AppLockService} clears the in-memory token before showing
   * the lock screen, and its own comment names this hazard. Once recorded, signing out and signing
   * back in returned the user to "your session has expired" — the successful login never got as far
   * as issuing a request. Hence the reset on both edges of a session, next to the acting-as clear
   * that is already there for the same reason.</p>
   */
  reset(): void {
    this.state.set({ kind: 'pending' });
  }

  /**
   * Runs the fork. Called on cold start, after an unlock, and after each of §6 decision 4's reset
   * triggers.
   *
   * Order matters: the selection is cleared FIRST. A selection that outlives its session is applied
   * silently to whoever signs in next, and on this app "the session" can span weeks of process
   * death, so clearing has to be unconditional rather than conditional on a new account.
   */
  restart(): void {
    this.state.set({ kind: 'pending' });
    const opened = this.actingAs.current();
    this.actingAs.clear();

    /**
     * An administrator, before anything is fetched.
     *
     * They have no `Profile` and never will, so "not onboarded" is their steady state rather than a
     * stage they are partway through — and until 2026-08-23 the fork below resolved them to
     * `onboarding-required` and stranded them on a dead end offering "Set up on the web". The web
     * had the same defect in `onboardingGuard` and fixed it a day earlier.
     *
     * Checked first because `/care-delegations/mine` has nothing to say about somebody who holds no
     * delegations and owns no record: the request is wasted at best, and at worst its failure sends
     * an administrator to a retry screen for a question that was never theirs.
     *
     * `opened` is read before `clear()` above, so an administrator who has already chosen a patient
     * goes back to the portal rather than to the finder. Without it, every re-entry to the shell
     * would throw away their choice and ask again.
     */
    if (this.account.hasAnyAuthority(Authority.ADMIN)) {
      if (opened) {
        this.actingAs.open(opened);
      }
      this.state.set({ kind: opened ? 'portal' : 'finder' });
      this.runs.update(n => n + 1);
      return;
    }

    this.careDelegations
      .mine()
      .pipe(
        switchMap(mine => this.decide(mine)),
        /**
         * DIVERGENCE FROM THE WEB, recorded in §8.3 and worth restating here.
         *
         * The web falls back to `setAvailable([])` when this call fails, which is right for a
         * desktop portal that is already showing the signed-in person's own record. Here, combined
         * with the cold-start reset, that turns a transient network failure into an angel-only user
         * staring at an empty portal under their own name — with the banner naming them, which is
         * the precise misinformation the banner exists to prevent.
         *
         * So a failed fork gets an explicit retry state instead. Failing visibly beats failing
         * plausibly.
         */
        catchError((error: { status?: number }) => of<ForkOutcome>({ kind: 'failed', status: error.status ?? null })),
      )
      .subscribe(outcome => {
        this.state.set(outcome);
        this.runs.update(n => n + 1);
      });
  }

  private decide(mine: MineResponse): Observable<ForkOutcome> {
    const choices = toActingAsChoices(mine);

    if (choices.length === 0) {
      /**
       * §3.2's FOURTH ROW — the one that has already been got wrong once, on the web.
       *
       * A nomination sitting at `PENDING` grants nothing, so it does not read as "acting for
       * somebody"; a naive guard sees no record of the caller's own and sends them to onboarding,
       * where the inverse guard keeps them. They end up asked to create a patient record purely to
       * answer somebody else's nomination.
       *
       * `toActingAsChoices` counts only ACTIVE delegations, which is correct for the picker and
       * exactly wrong for this question — so this reads the RAW list, not the choices.
       */
      /**
       * Asked again here, not only before the request. The check above is the fast path and depends on the account
       * having been fetched by the time the fork runs; this one depends on nothing but the answer that just came
       * back. An administrator legitimately has no record and no delegations — `/mine` returns 200 with an empty
       * `self` — and reading that as "not onboarded" is how a valid user is kept out for having no records, which
       * is the whole complaint. Two cheap checks beat one order-dependent one.
       */
      if (this.account.hasAnyAuthority(Authority.ADMIN)) {
        return of<ForkOutcome>({ kind: 'finder' });
      }

      const hasAnyNomination = (mine.delegations ?? []).length > 0;
      return of<ForkOutcome>({ kind: hasAnyNomination ? 'invitations-required' : 'onboarding-required' });
    }

    this.actingAs.setAvailable(choices);

    /**
     * More than one option and nothing auto-selected: ask. `setAvailable` has already auto-selected
     * when there was exactly one, because one option is not a decision.
     *
     * Do not choose on their behalf here, and do not restore a previous choice made by a different
     * account — there is nothing to restore from, by construction, because the selection is not
     * persisted at all on this app (§6 decision 4).
     */
    if (this.actingAs.mustChoose()) {
      return of<ForkOutcome>({ kind: 'must-choose' });
    }

    /**
     * One option, and it is theirs. Before letting them into the portal, confirm the record is
     * actually finished — a half-onboarded patient has a `patientId` and would otherwise land on
     * screens with nothing behind them.
     *
     * Only asked when the single choice is their OWN record. An angel acting for somebody is
     * onboarded by construction (a delegation only exists once that patient reached step 2), and
     * asking the backend about the ANGEL's onboarding would strand them on a dead end for a record
     * they are not looking at. That is the same mistake as §3.2's fourth row wearing a different
     * hat.
     */
    const current = this.actingAs.current();
    if (current?.own !== true) {
      return of<ForkOutcome>({ kind: 'portal' });
    }

    return this.onboardingStatus.status().pipe(
      /**
       * `onboarded`, never re-derived from `status` (§2.3). And on failure: let them in. A network
       * blip must not throw a fully onboarded patient at a dead end they cannot leave — the web's
       * `blankOnlyOn404` narrowing exists for the same reason, and this is that rule applied to the
       * one call that can strand somebody.
       */
      switchMap(status => of<ForkOutcome>({ kind: status.onboarded ? 'portal' : 'onboarding-required' })),
      catchError(() => of<ForkOutcome>({ kind: 'portal' })),
    );
  }
}
