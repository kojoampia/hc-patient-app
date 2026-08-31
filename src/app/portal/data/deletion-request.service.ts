/**
 * New in hc-patient-app — no origin in the web repo, which had no deletion path at all when this
 * was written. The web gains the same surface in the parity pass; this file is the reference for
 * the shape, not the other way round.
 *
 * Exists because Google Play requires an app that lets people create accounts to let them ask for
 * the account and its data to be deleted, from inside the app. It is not only a store requirement:
 * every other screen in this portal shows a patient their record, and this is the one that lets
 * them end it.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApplicationConfigService } from 'app/core/config/application-config.service';

/** Where the fourteen days are published in words. Must agree with `DeletionRequestService.WINDOW`. */
/**
 * Where the privacy policy lives, and it is deliberately NOT `abofonsa.com/privacy`.
 *
 * That host is the launch-preview site (`hc-abofonsa`), whose SPA fallback answers **200 with the
 * countdown page** for any path — measured 2026-08-31: 4,944 bytes titled "Launching 1 February".
 * So the link a patient followed from the delete-my-record screen showed them a marketing countdown,
 * on the one screen where they are deciding whether to erase their medical history. Nothing failed;
 * the status was 200 and the page rendered.
 *
 * The policy is served by the marketing site, `web.abofonsa.com`, and is correct there: it states
 * the fourteen-day window, names both routes into deletion, and lists what is erased.
 *
 * **If `abofonsa.com` ever becomes the marketing site, this moves back** — together with the twin
 * constant in the other client and the javadoc on `DeletionRequestService.WINDOW`. Check the
 * content-type and the title, not the status: this whole class of defect answers 200.
 */
export const PRIVACY_POLICY_URL = 'https://web.abofonsa.com/privacy';

/** The out-of-app deletion route, for somebody who cannot sign in. Play requires this to exist too. */
export const WEB_DELETION_URL = 'https://abofonsa.com/delete-account';

/**
 * A request as the patient service reports it.
 *
 * <p>The administrator-only fields — who completed it, what was erased — are deliberately absent
 * from this interface even though the endpoint returns them on a completed request. A patient
 * holding a `COMPLETED` request has no record left to look at it with, and typing the fields here
 * would invite a screen that renders them.</p>
 */
export interface DeletionRequest {
  readonly id: string;
  readonly patientId: string;
  readonly status: 'PENDING' | 'CANCELLED' | 'COMPLETED' | 'REJECTED';
  readonly reason?: string | null;
  /** ISO instant. */
  readonly requestedAt: string;
  /** ISO instant — `requestedAt` plus the published window. THE date shown to the patient. */
  readonly dueAt: string;
}

/**
 * Asking for the record to be erased, and withdrawing the ask.
 *
 * **There is no delete method here and there must never be one.** The patient service reserves the
 * erasure itself to `ROLE_ADMIN`; the most this client can do is start a clock and stop it again.
 * A method here that called anything destructive would be a client-side claim to an authority the
 * server does not grant — it would fail with 403, and the failure would be reported to a patient as
 * a bug in the app rather than as the refusal it is.
 */
@Injectable({ providedIn: 'root' })
export class DeletionRequestService {
  private readonly http = inject(HttpClient);
  private readonly applicationConfigService = inject(ApplicationConfigService);

  private readonly url = this.applicationConfigService.getEndpointFor('api/deletion-requests', 'hcpatientservice');

  /**
   * This patient's open request, or null.
   *
   * <p>The endpoint answers `204 No Content` when there is none, which `HttpClient` surfaces as a
   * null body — so having no pending deletion, the ordinary state of every account, is not an
   * error and does not travel as one.</p>
   */
  mine(): Observable<DeletionRequest | null> {
    return this.http.get<DeletionRequest | null>(`${this.url}/mine`);
  }

  /** Starts the clock. The reason is optional — nobody has to justify wanting to leave. */
  raise(reason?: string): Observable<DeletionRequest> {
    const trimmed = reason?.trim();
    return this.http.post<DeletionRequest>(this.url, trimmed ? { reason: trimmed } : {});
  }

  /** Stops it, while it is still pending. */
  cancel(id: string): Observable<DeletionRequest> {
    return this.http.post<DeletionRequest>(`${this.url}/${id}/cancel`, {});
  }
}
