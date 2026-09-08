/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/membership/service/membership.service.ts @ 12e418c
 * Divergence: constructor parameter properties replaced with inject(), and the injected fields
 *   declared ABOVE `resourceUrl`, which reads one of them. The generated form initialises a
 *   field from a constructor parameter property, which only works when TypeScript downlevels
 *   class fields; under native ES2022 semantics the initialiser runs first and the service is
 *   constructed with an undefined config. This form is correct under both. It is the same
 *   ordering hazard the @typescript-eslint/member-ordering rule's comment describes.
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { map } from 'rxjs/operators';

import dayjs from 'dayjs/esm';

import { isPresent } from 'app/core/util/operators';
import { DATE_FORMAT } from 'app/config/input.constants';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { createRequestOption } from 'app/core/request/request-util';
import { IMembership, NewMembership } from '../membership.model';

export type PartialUpdateMembership = Partial<IMembership> & Pick<IMembership, 'id'>;

type RestOf<T extends IMembership | NewMembership> = Omit<T, 'startDate' | 'renewalDate' | 'createdDate' | 'modifiedDate'> & {
  startDate?: string | null;
  renewalDate?: string | null;
  createdDate?: string | null;
  modifiedDate?: string | null;
};

export type RestMembership = RestOf<IMembership>;

export type NewRestMembership = RestOf<NewMembership>;

export type PartialUpdateRestMembership = RestOf<PartialUpdateMembership>;

export type EntityResponseType = HttpResponse<IMembership>;
export type EntityArrayResponseType = HttpResponse<IMembership[]>;

@Injectable({ providedIn: 'root' })
export class MembershipService {
  protected http = inject(HttpClient);
  protected applicationConfigService = inject(ApplicationConfigService);

  protected resourceUrl = this.applicationConfigService.getEndpointFor('api/memberships', 'hcpatientservice');

  create(membership: NewMembership): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(membership);
    return this.http
      .post<RestMembership>(this.resourceUrl, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  update(membership: IMembership): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(membership);
    return this.http
      .put<RestMembership>(`${this.resourceUrl}/${this.getMembershipIdentifier(membership)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  partialUpdate(membership: PartialUpdateMembership): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(membership);
    return this.http
      .patch<RestMembership>(`${this.resourceUrl}/${this.getMembershipIdentifier(membership)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  find(id: string): Observable<EntityResponseType> {
    return this.http
      .get<RestMembership>(`${this.resourceUrl}/${id}`, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http
      .get<RestMembership[]>(this.resourceUrl, { params: options, observe: 'response' })
      .pipe(map(res => this.convertResponseArrayFromServer(res)));
  }

  delete(id: string): Observable<HttpResponse<{}>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  getMembershipIdentifier(membership: Pick<IMembership, 'id'>): string {
    return membership.id;
  }

  compareMembership(o1: Pick<IMembership, 'id'> | null, o2: Pick<IMembership, 'id'> | null): boolean {
    return o1 && o2 ? this.getMembershipIdentifier(o1) === this.getMembershipIdentifier(o2) : o1 === o2;
  }

  addMembershipToCollectionIfMissing<Type extends Pick<IMembership, 'id'>>(
    membershipCollection: Type[],
    ...membershipsToCheck: (Type | null | undefined)[]
  ): Type[] {
    const memberships: Type[] = membershipsToCheck.filter(isPresent);
    if (memberships.length > 0) {
      const membershipCollectionIdentifiers = membershipCollection.map(membershipItem => this.getMembershipIdentifier(membershipItem)!);
      const membershipsToAdd = memberships.filter(membershipItem => {
        const membershipIdentifier = this.getMembershipIdentifier(membershipItem);
        if (membershipCollectionIdentifiers.includes(membershipIdentifier)) {
          return false;
        }
        membershipCollectionIdentifiers.push(membershipIdentifier);
        return true;
      });
      return [...membershipsToAdd, ...membershipCollection];
    }
    return membershipCollection;
  }

  protected convertDateFromClient<T extends IMembership | NewMembership | PartialUpdateMembership>(membership: T): RestOf<T> {
    return {
      ...membership,
      startDate: membership.startDate?.format(DATE_FORMAT) ?? null,
      renewalDate: membership.renewalDate?.format(DATE_FORMAT) ?? null,
      createdDate: membership.createdDate?.format(DATE_FORMAT) ?? null,
      modifiedDate: membership.modifiedDate?.format(DATE_FORMAT) ?? null,
    };
  }

  protected convertDateFromServer(restMembership: RestMembership): IMembership {
    return {
      ...restMembership,
      startDate: restMembership.startDate ? dayjs(restMembership.startDate) : undefined,
      renewalDate: restMembership.renewalDate ? dayjs(restMembership.renewalDate) : undefined,
      createdDate: restMembership.createdDate ? dayjs(restMembership.createdDate) : undefined,
      modifiedDate: restMembership.modifiedDate ? dayjs(restMembership.modifiedDate) : undefined,
    };
  }

  protected convertResponseFromServer(res: HttpResponse<RestMembership>): HttpResponse<IMembership> {
    return res.clone({
      body: res.body ? this.convertDateFromServer(res.body) : null,
    });
  }

  protected convertResponseArrayFromServer(res: HttpResponse<RestMembership[]>): HttpResponse<IMembership[]> {
    return res.clone({
      body: res.body ? res.body.map(item => this.convertDateFromServer(item)) : null,
    });
  }
}
