/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/care-delegation.service.ts @ 12e418c
 * Divergence: MineResponse.self and .delegations made optional — see the interface comment. The
 *   web declares them required while its own code guards them, which this repo's
 *   no-unnecessary-condition rule rejects.
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { ActingAsChoice } from 'app/core/auth/acting-as.service';

/** One delegation as the patient service reports it. */
export interface CareDelegation {
  readonly id: string;
  readonly patientId: string;
  readonly angelEmail: string;
  readonly angelName?: string | null;
  /** Resolved by the backend, because a delegation on its own names the angel and not the patient. */
  readonly patientName?: string | null;
  readonly status: 'STANDBY' | 'AWAITING_COUNTERSIGNATURE' | 'PENDING' | 'ACTIVE' | 'DECLINED' | 'REVOKED';
  readonly grantedAt?: string | null;
  readonly acceptedAt?: string | null;
  readonly revokedAt?: string | null;
  readonly revokedBy?: 'PATIENT' | 'ANGEL' | null;
}

/**
 * What `GET /api/care-delegations/mine` answers: who you are, and who you may act for.
 *
 * DIVERGENCE from the web: `self` and `delegations` are optional here. The web declares both as
 * required while its own code guards them (`response.self?.patientId`, `response.delegations ?? []`)
 * — so the guards are correct and the type disagrees with them. Under this repo's
 * `no-unnecessary-condition` rule that reads as dead code and fails the build, and deleting the
 * guards to satisfy it would be exactly the wrong fix: §3.1 says this endpoint answers for a caller
 * with NO PROFILE AT ALL, which is the case the guards exist for.
 *
 * Making the type honest keeps the runtime behaviour identical. Worth raising on the web repo.
 */
export interface MineResponse {
  readonly email: string;
  /** Empty when the caller has no patient record — an angel who is not themselves a patient. */
  readonly self?: { patientId?: string; firstName?: string; lastName?: string; onboardingStatus?: string };
  readonly delegations?: readonly CareDelegation[];
}

/**
 * The records this person may open, for the picker and the banner.
 *
 * Only ACTIVE delegations. A pending nomination or a dormant standby belongs on the invitations screen — offering
 * either here would present a record the very next request would refuse.
 */
export function toActingAsChoices(response: MineResponse): ActingAsChoice[] {
  const choices: ActingAsChoice[] = [];
  if (response.self?.patientId) {
    const name = [response.self.firstName, response.self.lastName].filter(Boolean).join(' ').trim();
    choices.push({ patientId: response.self.patientId, name: name || response.email, own: true });
  }
  for (const delegation of response.delegations ?? []) {
    if (delegation.status === 'ACTIVE') {
      // The patient's name, never the angel's: this label is how somebody tells whose record they are about to open.
      choices.push({ patientId: delegation.patientId, name: delegation.patientName ?? delegation.patientId, own: false });
    }
  }
  return choices;
}

/**
 * Who the signed-in person is, and who they may act for.
 *
 * `mine()` is the call made before anything else, and it has to answer for somebody with no record at all — a care
 * angel who is not themselves a patient is exactly that, which is why it cannot be resolved through the patient scope.
 */
@Injectable({ providedIn: 'root' })
export class CareDelegationService {
  private readonly http = inject(HttpClient);
  private readonly applicationConfigService = inject(ApplicationConfigService);

  private readonly url = this.applicationConfigService.getEndpointFor('api/care-delegations', 'hcpatientservice');

  mine(): Observable<MineResponse> {
    return this.http.get<MineResponse>(`${this.url}/mine`);
  }

  /** Nominations waiting on this person's answer. */
  myInvitations(): Observable<readonly CareDelegation[]> {
    return this.mine().pipe(map(response => (response.delegations ?? []).filter(delegation => delegation.status === 'PENDING')));
  }

  /** The delegations over the signed-in patient's own record, for the portal's delegation screen. */
  forCurrentPatient(): Observable<readonly CareDelegation[]> {
    return this.http.get<readonly CareDelegation[]>(this.url);
  }

  /** The only transition that grants anything, and only the nominee may make it. */
  accept(id: string): Observable<CareDelegation> {
    return this.http.post<CareDelegation>(`${this.url}/${id}/accept`, {});
  }

  decline(id: string): Observable<CareDelegation> {
    return this.http.post<CareDelegation>(`${this.url}/${id}/decline`, {});
  }

  revoke(id: string): Observable<CareDelegation> {
    return this.http.post<CareDelegation>(`${this.url}/${id}/revoke`, {});
  }
}
