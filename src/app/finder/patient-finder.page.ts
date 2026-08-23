/**
 * New in hc-patient-app. Shape reference:
 *   hc-patient-dashboard src/main/webapp/app/portal/patient-finder/patient-finder.component.ts @ e9476a9
 * Divergences: it is a route of its own rather than a branch inside the overview, and it keeps the
 *   three-state Resource discipline the rest of this app uses (§7.5) instead of a bare state enum.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonItem, IonLabel, IonList, IonSearchbar, IonSpinner } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import { ActingAsService } from 'app/core/auth/acting-as.service';
import { IProfile } from 'app/entities/patientMS/profile/profile.model';
import { ProfileService } from 'app/entities/patientMS/profile/service/profile.service';
import { LoginService } from 'app/login/login.service';
import { SessionBootstrapService } from 'app/fork/session-bootstrap.service';

/** How many rows one search returns. A page, not a roster — the count says how many there are. */
const PAGE_SIZE = 50;

/** Long enough that typing a name is one request rather than eight, short enough not to feel laggy. */
const DEBOUNCE_MS = 250;

type FinderState = 'loading' | 'ready' | 'failed';

interface SearchResult {
  readonly profiles: readonly IProfile[];
  readonly total: number;
}

/**
 * Find a patient, and open their record.
 *
 * <h2>Why an administrator sees this at all</h2>
 *
 * <p>They have no `Profile` and never will, so the portal has nothing of their own to show. Until
 * 2026-08-23 the fork resolved them to `onboarding-required` and stranded them on a dead end
 * offering "Set up on the web" — the same defect the web had in `onboardingGuard`.</p>
 *
 * <h2>What opening a record does, and what it does not</h2>
 *
 * <p>It grants nothing. The authority is the role, re-read by the backend on every request, and an
 * administrator could already read any of these patients. What the selection does is <em>narrow</em>
 * — `PatientScope` confines a caller who names a patient to that patient — which is what makes the
 * portal show one record rather than every patient's records under one person's name.</p>
 *
 * <p>So the acting-as banner behind this is not decoration. Everything on screen afterwards belongs
 * to somebody else, and the failure it prevents is reading a blood group believing it is the right
 * patient's.</p>
 */
@Component({
  selector: 'hpm-patient-finder',
  templateUrl: './patient-finder.page.html',
  styleUrl: './patient-finder.page.scss',
  imports: [FormsModule, TranslateModule, IonContent, IonSearchbar, IonList, IonItem, IonLabel, IonButton, IonSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientFinderPage {
  private readonly profileService = inject(ProfileService);
  private readonly actingAsService = inject(ActingAsService);
  private readonly bootstrap = inject(SessionBootstrapService);
  private readonly loginService = inject(LoginService);
  private readonly router = inject(Router);

  readonly state = signal<FinderState>('loading');
  readonly search = signal('');
  readonly profiles = signal<readonly IProfile[]>([]);
  readonly total = signal(0);

  /** True when the server has more matches than this page shows. */
  readonly moreThanShown = computed(() => this.total() > this.profiles().length);

  constructor() {
    toObservable(this.search)
      .pipe(
        map(term => term.trim()),
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged(),
        tap(() => this.state.set('loading')),
        // switchMap and not mergeMap: the request for "ko" must not land after the request for
        // "kojo" and repaint the older answer under the newer term. Invisible on a fast network and
        // routine on a phone, and what it shows is one patient's row under another's name.
        switchMap(term => this.fetch(term)),
        takeUntilDestroyed(),
      )
      .subscribe(result => {
        if (result === null) {
          this.state.set('failed');
          return;
        }
        this.profiles.set(result.profiles);
        this.total.set(result.total);
        this.state.set('ready');
      });
  }

  /** Re-runs the current search. distinctUntilChanged would swallow setting the term to itself. */
  retry(): void {
    const term = this.search();
    this.search.set(term === '' ? ' ' : '');
    this.search.set(term);
  }

  /**
   * Opens a patient's record and enters the portal.
   *
   * <p>The fork is restarted rather than navigated past, so the one place that decides where a
   * signed-in person goes stays the only one. It now sees an opened record and answers `portal`.</p>
   */
  open(profile: IProfile): void {
    this.actingAsService.open({
      // patientId falling back to id, matching how PatientScope resolves identity: profiles written
      // before the field existed carry only their own id, and sending the wrong one scopes every
      // later request to a patient with no records — an empty chart rather than an error.
      patientId: profile.patientId ?? profile.id,
      name: this.nameOf(profile),
      own: false,
    });
    this.bootstrap.restart();
    void this.router.navigate(['/tabs']);
  }

  signOut(): void {
    this.loginService.logout();
    void this.router.navigate(['/login']);
  }

  nameOf(profile: IProfile): string {
    // First non-blank, rather than a chain of `||`: this repo's lint bans that operator, and `??`
    // would be wrong here anyway — it falls through null and undefined but not an empty string,
    // which is exactly the case being guarded against.
    const candidates = [[profile.firstName, profile.lastName].filter(Boolean).join(' ').trim(), profile.email, profile.patientId];
    // Never the raw id except as a last resort: a row reading "664f…" is not a person, and the
    // email is the field the record is looked up by.
    return candidates.find(value => !!value && value.trim() !== '') ?? profile.id;
  }

  /** Null means the request failed, which is not the same answer as nobody matched. */
  private fetch(term: string): Observable<SearchResult | null> {
    const query: Record<string, unknown> = { size: PAGE_SIZE, sort: ['lastName,asc'] };
    if (term) {
      query['search'] = term;
    }
    return this.profileService.query(query).pipe(
      map((response: HttpResponse<IProfile[]>) => {
        const profiles = response.body ?? [];
        // Falling back to the page length rather than to zero: a missing header should read as
        // "this is all of them", not as "there are none" under a full list.
        const total = Number(response.headers.get('X-Total-Count') ?? profiles.length);
        return { profiles, total: Number.isFinite(total) ? total : profiles.length };
      }),
      // Deliberately not an empty list. "Nobody matched" and "the request failed" look identical in
      // a list and mean opposite things.
      catchError(() => of(null)),
    );
  }
}
