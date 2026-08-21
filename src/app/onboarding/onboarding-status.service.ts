/**
 * Partially lifted from hc-patient-dashboard
 *   src/main/webapp/app/onboarding/onboarding.model.ts     @ 12e418c  (OnboardingStatus only)
 *   src/main/webapp/app/onboarding/onboarding.service.ts   @ 12e418c  (status() only)
 * Divergence: only the read half is here. §6 decision 2 keeps the five-step wizard OUT of this app,
 *   so start(), the four PATCH steps, complete() and the care-angel call have no caller and are not
 *   copied. The status call stays because the fork still has to know where to send somebody.
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApplicationConfigService } from 'app/core/config/application-config.service';

export interface OnboardingStatus {
  /** Null means COMPLETE — every profile written before onboarding existed reads null. */
  readonly status: 'IN_PROGRESS' | 'COMPLETE' | null;
  /** The highest step answered, so a returning patient resumes rather than restarts. */
  readonly step: number | null;
  /** Null when there is no record at all, which is what "not started" actually is. */
  readonly profileId: string | null;
  /** The backend's own answer to the guard's question, so the rule lives in one place. */
  readonly onboarded: boolean;
}

@Injectable({ providedIn: 'root' })
export class OnboardingStatusService {
  private readonly http = inject(HttpClient);
  private readonly applicationConfigService = inject(ApplicationConfigService);

  /**
   * Field initialiser, and safe only because the APP_INITIALIZER sets the endpoint prefix before
   * any service is constructed (§7.7.3). This is the pattern every lifted data service uses.
   */
  private readonly url = this.applicationConfigService.getEndpointFor('api/onboarding', 'hcpatientservice');

  /**
   * Answers for somebody with no record at all, which is the whole point.
   *
   * **Read `onboarded`. Do not re-derive it from `status`** (§2.3). A null `onboardingStatus` means
   * COMPLETE, not NOT_STARTED — every patient who existed before this feature has one. Getting it
   * backwards drags the entire existing patient base to a dead end they cannot leave, which on this
   * app is worse than on the web because there is no wizard here to finish.
   */
  status(): Observable<OnboardingStatus> {
    return this.http.get<OnboardingStatus>(`${this.url}/status`);
  }
}
