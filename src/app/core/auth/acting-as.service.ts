/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/core/auth/acting-as.service.ts @ 12e418c
 * Divergence: sessionStorage persistence removed ENTIRELY — the selection lives only in the signal.
 *   Copying the web's storage rule verbatim would ship a real defect wearing the web's safety
 *   property as a disguise. See the class comment and patient-mobile.md §6 decision 4.
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable, computed, signal } from '@angular/core';
import { BehaviorSubject, Observable, distinctUntilChanged, map } from 'rxjs';

/** One of the records the signed-in person may open. */
export interface ActingAsChoice {
  readonly patientId: string;
  /** How this record is named in the picker and the banner. */
  readonly name: string;
  /** True when this is the signed-in person's own record rather than one they act for. */
  readonly own: boolean;
}

/**
 * Which patient's record the portal is currently showing.
 *
 * <h2>Why there is no storage here, unlike the web</h2>
 *
 * <p>The web keeps the selection in `sessionStorage` deliberately: whose record is on screen must
 * not outlive the session or greet the next person at the browser. That is a genuine safety
 * property there, and it does not survive the port, because <strong>a Capacitor webview has no
 * meaningful session</strong>. Its storage persists for weeks, across backgrounding and process
 * death, and it survives a different account signing in. The same code that protects a desktop user
 * would, here, silently apply one person's choice of medical record to the next.</p>
 *
 * <p>So the selection lives only in this signal — it dies with the process by construction — and
 * the four reset triggers in §6 decision 4 replace the storage rule: cold start, resume after more
 * than {@link LONG_ABSENCE_MS} backgrounded, sign-out, and 401. After each, the §3.2 fork runs
 * again.</p>
 *
 * <h2>The consequence to handle deliberately</h2>
 *
 * <p>An angel holding exactly one delegation is auto-selected on every cold start, because one
 * option is not a decision. The banner's `role="status"` therefore will NOT re-announce a string
 * that has not changed. Whatever renders the banner must re-announce explicitly after each fork
 * run — see §6 decision 4. That is a phase 3 obligation; it is written here because this is the
 * service whose behaviour causes it.</p>
 *
 * <h2>The one rule, unchanged from the web</h2>
 *
 * <p>The header is set by `ActingAsInterceptor` and nowhere else. A screen that built its own
 * request and forgot it would show the wrong patient's record while returning 200.</p>
 */
@Injectable({ providedIn: 'root' })
export class ActingAsService {
  private readonly choices = signal<readonly ActingAsChoice[]>([]);
  private readonly selectedId = signal<string | null>(null);
  /** Bumped by every mutator below, so {@link current$} can re-read without duplicating the state. */
  private readonly changed$ = new BehaviorSubject<void>(undefined);

  /** Everything the signed-in person may open: their own record, plus each patient they act for. */
  readonly available = this.choices.asReadonly();

  readonly current = computed<ActingAsChoice | null>(() => {
    const id = this.selectedId();
    const all = this.choices();
    return all.find(choice => choice.patientId === id) ?? null;
  });

  /** True when the open record is not the signed-in person's own. Drives the banner. */
  readonly actingForSomeoneElse = computed(() => {
    const choice = this.current();
    return !!choice && !choice.own;
  });

  /** Whether a choice is even needed. One option is not a decision. */
  readonly mustChoose = computed(() => this.choices().length > 1 && this.current() === null);

  /**
   * The same value as {@link current}, for the data layer, which is RxJS rather than signals.
   *
   * <p>Deliberately not `toObservable(this.current)`. That defers the first emission to the next
   * effect flush, and the subscriber here is the pipeline that decides *whose record the portal is
   * showing* — it must resolve on subscribe, in the same turn.</p>
   */
  readonly current$: Observable<ActingAsChoice | null> = this.changed$.pipe(
    map(() => this.current()),
    distinctUntilChanged((a, b) => a?.patientId === b?.patientId),
  );

  /**
   * Records what this person may open, and auto-selects when there is nothing to decide.
   *
   * @param choices their own record (if any) and every patient they hold an active delegation for.
   */
  setAvailable(choices: readonly ActingAsChoice[]): void {
    this.choices.set(choices);
    const remembered = this.selectedId();
    if (remembered && choices.some(choice => choice.patientId === remembered)) {
      return;
    }
    this.selectedId.set(null);
    if (choices.length === 1) {
      this.select(choices[0].patientId);
      return;
    }
    this.changed$.next();
  }

  select(patientId: string): void {
    this.selectedId.set(patientId);
    this.changed$.next();
  }

  /** The header value, or null when the portal has nothing to say. */
  header(): string | null {
    return this.current()?.patientId ?? null;
  }

  /** Cleared on sign-in and sign-out, and by the other two §6 decision 4 triggers. */
  clear(): void {
    this.choices.set([]);
    this.selectedId.set(null);
    this.changed$.next();
  }
}
