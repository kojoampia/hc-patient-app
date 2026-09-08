/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/visitation/service/visitation.service.ts @ 12e418c
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
import { IVisitation, NewVisitation } from '../visitation.model';

export type PartialUpdateVisitation = Partial<IVisitation> & Pick<IVisitation, 'id'>;

type RestOf<T extends IVisitation | NewVisitation> = Omit<T, 'visitedAt' | 'createdDate' | 'modifiedDate'> & {
  visitedAt?: string | null;
  createdDate?: string | null;
  modifiedDate?: string | null;
};

export type RestVisitation = RestOf<IVisitation>;

export type NewRestVisitation = RestOf<NewVisitation>;

export type PartialUpdateRestVisitation = RestOf<PartialUpdateVisitation>;

export type EntityResponseType = HttpResponse<IVisitation>;
export type EntityArrayResponseType = HttpResponse<IVisitation[]>;

@Injectable({ providedIn: 'root' })
export class VisitationService {
  protected http = inject(HttpClient);
  protected applicationConfigService = inject(ApplicationConfigService);

  protected resourceUrl = this.applicationConfigService.getEndpointFor('api/visitations', 'hcpatientservice');

  create(visitation: NewVisitation): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(visitation);
    return this.http
      .post<RestVisitation>(this.resourceUrl, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  update(visitation: IVisitation): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(visitation);
    return this.http
      .put<RestVisitation>(`${this.resourceUrl}/${this.getVisitationIdentifier(visitation)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  partialUpdate(visitation: PartialUpdateVisitation): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(visitation);
    return this.http
      .patch<RestVisitation>(`${this.resourceUrl}/${this.getVisitationIdentifier(visitation)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  find(id: string): Observable<EntityResponseType> {
    return this.http
      .get<RestVisitation>(`${this.resourceUrl}/${id}`, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http
      .get<RestVisitation[]>(this.resourceUrl, { params: options, observe: 'response' })
      .pipe(map(res => this.convertResponseArrayFromServer(res)));
  }

  delete(id: string): Observable<HttpResponse<{}>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  getVisitationIdentifier(visitation: Pick<IVisitation, 'id'>): string {
    return visitation.id;
  }

  compareVisitation(o1: Pick<IVisitation, 'id'> | null, o2: Pick<IVisitation, 'id'> | null): boolean {
    return o1 && o2 ? this.getVisitationIdentifier(o1) === this.getVisitationIdentifier(o2) : o1 === o2;
  }

  addVisitationToCollectionIfMissing<Type extends Pick<IVisitation, 'id'>>(
    visitationCollection: Type[],
    ...visitationsToCheck: (Type | null | undefined)[]
  ): Type[] {
    const visitations: Type[] = visitationsToCheck.filter(isPresent);
    if (visitations.length > 0) {
      const visitationCollectionIdentifiers = visitationCollection.map(visitationItem => this.getVisitationIdentifier(visitationItem)!);
      const visitationsToAdd = visitations.filter(visitationItem => {
        const visitationIdentifier = this.getVisitationIdentifier(visitationItem);
        if (visitationCollectionIdentifiers.includes(visitationIdentifier)) {
          return false;
        }
        visitationCollectionIdentifiers.push(visitationIdentifier);
        return true;
      });
      return [...visitationsToAdd, ...visitationCollection];
    }
    return visitationCollection;
  }

  protected convertDateFromClient<T extends IVisitation | NewVisitation | PartialUpdateVisitation>(visitation: T): RestOf<T> {
    return {
      ...visitation,
      visitedAt: visitation.visitedAt?.toJSON() ?? null,
      createdDate: visitation.createdDate?.format(DATE_FORMAT) ?? null,
      modifiedDate: visitation.modifiedDate?.format(DATE_FORMAT) ?? null,
    };
  }

  protected convertDateFromServer(restVisitation: RestVisitation): IVisitation {
    return {
      ...restVisitation,
      visitedAt: restVisitation.visitedAt ? dayjs(restVisitation.visitedAt) : undefined,
      createdDate: restVisitation.createdDate ? dayjs(restVisitation.createdDate) : undefined,
      modifiedDate: restVisitation.modifiedDate ? dayjs(restVisitation.modifiedDate) : undefined,
    };
  }

  protected convertResponseFromServer(res: HttpResponse<RestVisitation>): HttpResponse<IVisitation> {
    return res.clone({
      body: res.body ? this.convertDateFromServer(res.body) : null,
    });
  }

  protected convertResponseArrayFromServer(res: HttpResponse<RestVisitation[]>): HttpResponse<IVisitation[]> {
    return res.clone({
      body: res.body ? res.body.map(item => this.convertDateFromServer(item)) : null,
    });
  }
}
