/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/membership-plan.service.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

import { ApplicationConfigService } from 'app/core/config/application-config.service';

/** One tier, as Abofonsa's content API describes it. */
export interface MembershipPlan {
  readonly id: string;
  /** PEAR, PAWPAW or MELON. */
  readonly code: string;
  readonly name: string;
  readonly forWho?: string | null;
  /** Already formatted for the requesting locale — render it, never re-format it. */
  readonly priceAmount?: string | null;
  readonly priceCurrency?: string | null;
  readonly priceNote?: string | null;
  readonly featured?: boolean;
  readonly features?: readonly { readonly label?: string | null; readonly included?: boolean }[];
  readonly displayOrder?: number;
}

/**
 * The membership tiers a patient can choose from.
 *
 * <h2>They belong to another product</h2>
 *
 * <p>Plans live in Abofonsa's content API, not in this subsystem. The gateway proxies them at {@code /api/plans} so
 * the browser stays same-origin: production builds with {@code SERVER_API_URL} empty, no CORS is configured anywhere
 * here, and production enforces a CSP — a direct call to another host would need all three changed to read a price
 * list.</p>
 *
 * <p>Prices arrive pre-formatted for the locale. That is deliberate on their side and worth respecting on this one:
 * the subsystem has a documented history of two products quoting different numbers for the same tier, and the way
 * that stays fixed is by never restating a price.</p>
 *
 * <h2>Unavailable is a normal state</h2>
 *
 * <p>Abofonsa is separately deployed and, at the time of writing, its production host is not yet serving. A patient
 * must not meet an error page because a second product is down — plan selection is the one part of onboarding that
 * was deliberately moved out of the journey for exactly this reason. An empty list means "not available", and the
 * screen says so quietly.</p>
 */
@Injectable({ providedIn: 'root' })
export class MembershipPlanService {
  private readonly http = inject(HttpClient);
  private readonly applicationConfigService = inject(ApplicationConfigService);

  /** No microservice segment: the gateway serves this itself, from another product. */
  private readonly url = this.applicationConfigService.getEndpointFor('api/plans');

  /**
   * The published tiers, or an empty list if they cannot be reached.
   *
   * @param locale the language to price and describe them in.
   */
  plans(locale = 'en'): Observable<readonly MembershipPlan[]> {
    return this.http
      .get<readonly MembershipPlan[]>(`${this.url}?locale=${encodeURIComponent(locale)}`)
      .pipe(catchError(() => of([] as readonly MembershipPlan[])));
  }
}
