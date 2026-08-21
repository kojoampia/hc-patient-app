/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/patient-context.service.ts @ 12e418c
 * Divergence: `profile$` becomes `profileState$` and `careTeam$` becomes `careTeamState$`, both
 *   wrapped in Resource<T> (patient-mobile.md §7.5). `blankOnlyOn404` is UNCHANGED — see its own
 *   comment, and do not widen it. `patientId$` is kept as a plain stream because it is an input to
 *   other pipelines rather than something a template renders.
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, ReplaySubject, catchError, combineLatest, map, of, shareReplay, startWith, switchMap, throwError } from 'rxjs';

import { LOADING, Resource, failed, loaded } from './resource';
import dayjs from 'dayjs/esm';

import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { AccountService } from 'app/core/auth/account.service';
import { ActingAsChoice, ActingAsService } from 'app/core/auth/acting-as.service';
import { IProfile } from 'app/entities/patientMS/profile/profile.model';
import { RestProfile } from 'app/entities/patientMS/profile/service/profile.service';
import { IProfessional } from 'app/entities/patientMS/professional/professional.model';
import { ProfessionalService } from 'app/entities/patientMS/professional/service/professional.service';

/** A care-team member, resolved to something a template can render directly. */
export interface CareTeamMember {
  readonly id: string;
  /** How this person is named on screen, honorific included: "Dr. Grace Mensah". */
  readonly name: string;
  readonly role: string;
  readonly initials: string;
  readonly location: string;
  readonly imageUrl: string | null;
}

/** The stand-in used when a record references a professional the care team list does not have. */
const UNKNOWN_MEMBER: CareTeamMember = {
  id: '',
  name: 'Care team',
  role: 'Abofonsa BridgeCare',
  initials: 'AB',
  location: '',
  imageUrl: null,
};

/**
 * Answers the two questions every portal screen starts with: *which patient is this*, and *who
 * are the people named on their records*.
 *
 * Both answers are fetched once per session and shared — a dozen screens asking independently
 * would otherwise mean a dozen identical round trips. Callers that need fresh data after a write
 * call {@link reload}.
 */
@Injectable({ providedIn: 'root' })
export class PatientContextService {
  private readonly http = inject(HttpClient);
  private readonly applicationConfigService = inject(ApplicationConfigService);
  private readonly accountService = inject(AccountService);
  private readonly professionalService = inject(ProfessionalService);
  private readonly actingAsService = inject(ActingAsService);

  private readonly profileUrl = this.applicationConfigService.getEndpointFor('api/profiles', 'hcpatientservice');

  /** Bumped by reload() to re-run the shared pipelines below. */
  private readonly refresh$ = new ReplaySubject<void>(1);

  /**
   * Whose record this is.
   *
   * <p><b>This follows the acting-as selection, and must keep doing so.</b> It used to resolve the signed-in
   * account's email and nothing else, which made the whole delegation feature inert: a care angel who selected the
   * patient they act for got the banner naming that patient over their *own* empty record, because every collection
   * downstream is filtered by the `patientId` this yields. The banner said one thing and the screen showed another,
   * and neither the unit tests nor the API-level checks could see it — the interceptor was sending the right header
   * all along, and the server was answering correctly.</p>
   */
  readonly profileState$: Observable<Resource<IProfile | null>> = combineLatest([
    this.refresh$,
    // The selection arrives after `/care-delegations/mine` answers, which is later than the first fetch here; without
    // reacting to it, an angel would need a second reload to see the record they picked.
    this.actingAsService.current$,
  ]).pipe(
    switchMap(([, choice]) =>
      this.fetchProfile(choice).pipe(
        map(profile => loaded(profile)),
        catchError((error: unknown) => of(failed<IProfile | null>(error))),
        /**
         * INSIDE the switchMap, so switching records resets this to `loading` rather than leaving
         * the previous patient's profile on screen while the new one is in flight. Same placement
         * and same reason as PortalDataService.scoped() — see §7.5.
         */
        startWith(LOADING as Resource<IProfile | null>),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * The id every other collection is filtered by. Falls back to the profile's own id, because
   * older profile documents were written before `patientId` existed.
   *
   * Kept as a plain `Resource`-carrying stream rather than a bare string: `PortalDataService` has to
   * distinguish "still loading the profile" from "loaded, and this patient has no record", and
   * collapsing them here would push that decision back into twelve call sites.
   */
  readonly patientIdState$: Observable<Resource<string | null>> = this.profileState$.pipe(
    map(state => (state.state === 'loaded' ? loaded(state.value?.patientId ?? state.value?.id ?? null) : state)),
  );

  readonly careTeamState$: Observable<Resource<readonly CareTeamMember[]>> = this.refresh$.pipe(
    switchMap(() =>
      this.professionalService.query().pipe(
        map(response => loaded((response.body ?? []).map(professional => toMember(professional)) as readonly CareTeamMember[])),
        /**
         * The web has `catchError(() => of([]))` here — the same defect as the twelve collections,
         * and §7.5 says careTeam$ "has the same defect and gets the same treatment". An empty care
         * team and an unreachable one are not the same thing: the first means nobody is assigned,
         * the second means we do not know who is.
         */
        catchError((error: unknown) => of(failed<readonly CareTeamMember[]>(error))),
        startWith(LOADING as Resource<readonly CareTeamMember[]>),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * Care team indexed by id, for resolving the professional named on a case, visit or report.
   *
   * Resolves to an EMPTY MAP while loading or failed rather than propagating the state, because its
   * consumers go through {@link memberOf}, which already falls back to a stand-in. A case timeline
   * that cannot name its clinician should still render the case.
   */
  readonly careTeamById$: Observable<ReadonlyMap<string, CareTeamMember>> = this.careTeamState$.pipe(
    map(state => new Map((state.state === 'loaded' ? state.value : []).map(member => [member.id, member]))),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  constructor() {
    this.refresh$.next();
  }

  /** Resolves a professional id against the care team, never returning null. */
  static memberOf(byId: ReadonlyMap<string, CareTeamMember>, id: string | null | undefined): CareTeamMember {
    return (id ? byId.get(id) : undefined) ?? UNKNOWN_MEMBER;
  }

  /**
   * Who to credit for a record the patient can read.
   *
   * `source` decides before `authorId` does, and that order is the point: an entry the patient
   * wrote has no professional to resolve, so resolving first falls through to the "Care team"
   * stand-in and the portal tells them their own note was written by somebody else. The case
   * timeline did exactly that while the activity trail did not, which is why this now lives in one
   * place rather than in each screen that shows a trail.
   */
  static authorNameOf(byId: ReadonlyMap<string, CareTeamMember>, entry: { source?: string | null; authorId?: string | null }): string {
    if (entry.source === 'PATIENT') {
      return 'You';
    }
    if (entry.source === 'SYSTEM') {
      return 'Abofonsa BridgeCare';
    }
    return PatientContextService.memberOf(byId, entry.authorId).name;
  }

  /** Re-fetches the profile and care team. Call after a write that changes either. */
  reload(): void {
    this.refresh$.next();
  }

  /**
   * The record for the current selection: the patient an angel is acting for, or the signed-in person's own.
   *
   * <p>Two endpoints, because they answer two different questions. `/profiles/email/{email}` is the bootstrap — the
   * only identifier a client holds before it has loaded anything is the token's email — and the server deliberately
   * refuses it for any address but the caller's own, so it cannot serve the acting-as case. `/profiles?patientId=`
   * goes through `PatientScope`, which resolves the `X-Acting-As` header the interceptor already sends and answers
   * for exactly the records this caller may open. An angel with no delegation gets nothing back, not somebody
   * else's record.</p>
   */
  private fetchProfile(choice: ActingAsChoice | null): Observable<IProfile | null> {
    if (choice && !choice.own) {
      return this.http.get<RestProfile[]>(this.profileUrl, { params: new HttpParams().set('patientId', choice.patientId) }).pipe(
        map(profiles => (profiles.length ? withParsedDates(profiles[0]) : null)),
        catchError((error: unknown) => this.blankOnlyOn404(error)),
      );
    }
    return this.accountService.identity().pipe(
      switchMap(account => {
        if (!account?.email) {
          return of(null);
        }
        return this.http.get<RestProfile>(`${this.profileUrl}/email/${encodeURIComponent(account.email)}`).pipe(
          // This endpoint is fetched directly rather than through ProfileService, because that
          // service has no by-email method — so the date conversion it would have applied has to
          // happen here. Without it `birthDate` stays the ISO string the API sent, and every screen
          // that formats it renders blank: this is what emptied `/record` and the profile's About tab.
          map(profile => withParsedDates(profile)),
          catchError((error: unknown) => this.blankOnlyOn404(error)),
        );
      }),
    );
  }

  /**
   * Only a 404. A signed-in user with no profile document yet is a normal state — it is what "has not onboarded"
   * looks like — but a network blip, a 500 or an expired token are not, and mapping those to null too would be worse
   * than useless now that the onboarding guard reads this: a transient error would throw a fully onboarded patient
   * into the wizard, and a 401 would look like a brand-new account. **Do not widen this.**
   */
  private blankOnlyOn404(error: unknown): Observable<IProfile | null> {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return of(null);
    }
    return throwError(() => error);
  }
}

/**
 * The date conversion `ProfileService` applies to everything it fetches, for the one endpoint it
 * does not cover. Kept beside the caller rather than added to the generated service, which is a
 * JHipster regeneration point.
 */
function withParsedDates(profile: RestProfile): IProfile {
  return {
    ...profile,
    birthDate: profile.birthDate ? dayjs(profile.birthDate) : undefined,
  };
}

function toMember(professional: IProfessional): CareTeamMember {
  const name = [professional.firstName, professional.lastName].filter(Boolean).join(' ').trim();
  // The honorific is part of how a person is addressed, so it belongs to the name rather than
  // being a second field every caller has to remember to render. `initialsOf` strips it again.
  const addressed = [professional.honorific, name].filter(Boolean).join(' ').trim();
  return {
    id: professional.id,
    name: addressed || 'Care team',
    role: professional.role ?? professional.specialty ?? '',
    initials: professional.initials ?? initialsOf(name),
    location: professional.location ?? '',
    imageUrl: professional.imageUrl ?? null,
  };
}

/** "Dr. Grace Mensah" -> "GM". The honorific is dropped so it does not become the initial. */
function initialsOf(name: string): string {
  const parts = name
    .replace(/^(Dr|Prof|Mr|Mrs|Ms|Mx)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return 'AB';
  }
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts.at(-1)![0]}`;
  return letters.toUpperCase();
}
