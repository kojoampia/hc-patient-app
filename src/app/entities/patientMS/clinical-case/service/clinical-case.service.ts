/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/clinical-case/service/clinical-case.service.ts @ 12e418c
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
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { createRequestOption } from 'app/core/request/request-util';
import { IClinicalCase, NewClinicalCase } from '../clinical-case.model';

export type PartialUpdateClinicalCase = Partial<IClinicalCase> & Pick<IClinicalCase, 'id'>;

type RestOf<T extends IClinicalCase | NewClinicalCase> = Omit<T, 'openedAt' | 'closedAt'> & {
  openedAt?: string | null;
  closedAt?: string | null;
};

export type RestClinicalCase = RestOf<IClinicalCase>;

export type NewRestClinicalCase = RestOf<NewClinicalCase>;

export type PartialUpdateRestClinicalCase = RestOf<PartialUpdateClinicalCase>;

export type EntityResponseType = HttpResponse<IClinicalCase>;
export type EntityArrayResponseType = HttpResponse<IClinicalCase[]>;

@Injectable({ providedIn: 'root' })
export class ClinicalCaseService {
  protected http = inject(HttpClient);
  protected applicationConfigService = inject(ApplicationConfigService);

  protected resourceUrl = this.applicationConfigService.getEndpointFor('api/clinical-cases', 'hcpatientservice');


  create(clinicalCase: NewClinicalCase): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(clinicalCase);
    return this.http
      .post<RestClinicalCase>(this.resourceUrl, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  update(clinicalCase: IClinicalCase): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(clinicalCase);
    return this.http
      .put<RestClinicalCase>(`${this.resourceUrl}/${this.getClinicalCaseIdentifier(clinicalCase)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  partialUpdate(clinicalCase: PartialUpdateClinicalCase): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(clinicalCase);
    return this.http
      .patch<RestClinicalCase>(`${this.resourceUrl}/${this.getClinicalCaseIdentifier(clinicalCase)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  find(id: string): Observable<EntityResponseType> {
    return this.http
      .get<RestClinicalCase>(`${this.resourceUrl}/${id}`, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http
      .get<RestClinicalCase[]>(this.resourceUrl, { params: options, observe: 'response' })
      .pipe(map(res => this.convertResponseArrayFromServer(res)));
  }

  delete(id: string): Observable<HttpResponse<{}>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  getClinicalCaseIdentifier(clinicalCase: Pick<IClinicalCase, 'id'>): string {
    return clinicalCase.id;
  }

  compareClinicalCase(o1: Pick<IClinicalCase, 'id'> | null, o2: Pick<IClinicalCase, 'id'> | null): boolean {
    return o1 && o2 ? this.getClinicalCaseIdentifier(o1) === this.getClinicalCaseIdentifier(o2) : o1 === o2;
  }

  addClinicalCaseToCollectionIfMissing<Type extends Pick<IClinicalCase, 'id'>>(
    clinicalCaseCollection: Type[],
    ...clinicalCasesToCheck: (Type | null | undefined)[]
  ): Type[] {
    const clinicalCases: Type[] = clinicalCasesToCheck.filter(isPresent);
    if (clinicalCases.length > 0) {
      const clinicalCaseCollectionIdentifiers = clinicalCaseCollection.map(
        clinicalCaseItem => this.getClinicalCaseIdentifier(clinicalCaseItem)!,
      );
      const clinicalCasesToAdd = clinicalCases.filter(clinicalCaseItem => {
        const clinicalCaseIdentifier = this.getClinicalCaseIdentifier(clinicalCaseItem);
        if (clinicalCaseCollectionIdentifiers.includes(clinicalCaseIdentifier)) {
          return false;
        }
        clinicalCaseCollectionIdentifiers.push(clinicalCaseIdentifier);
        return true;
      });
      return [...clinicalCasesToAdd, ...clinicalCaseCollection];
    }
    return clinicalCaseCollection;
  }

  protected convertDateFromClient<T extends IClinicalCase | NewClinicalCase | PartialUpdateClinicalCase>(clinicalCase: T): RestOf<T> {
    return {
      ...clinicalCase,
      openedAt: clinicalCase.openedAt?.toJSON() ?? null,
      closedAt: clinicalCase.closedAt?.toJSON() ?? null,
    };
  }

  protected convertDateFromServer(restClinicalCase: RestClinicalCase): IClinicalCase {
    return {
      ...restClinicalCase,
      openedAt: restClinicalCase.openedAt ? dayjs(restClinicalCase.openedAt) : undefined,
      closedAt: restClinicalCase.closedAt ? dayjs(restClinicalCase.closedAt) : undefined,
    };
  }

  protected convertResponseFromServer(res: HttpResponse<RestClinicalCase>): HttpResponse<IClinicalCase> {
    return res.clone({
      body: res.body ? this.convertDateFromServer(res.body) : null,
    });
  }

  protected convertResponseArrayFromServer(res: HttpResponse<RestClinicalCase[]>): HttpResponse<IClinicalCase[]> {
    return res.clone({
      body: res.body ? res.body.map(item => this.convertDateFromServer(item)) : null,
    });
  }
}
