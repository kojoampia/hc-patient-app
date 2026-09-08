/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/allergy/service/allergy.service.ts @ 12e418c
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
import { IAllergy, NewAllergy } from '../allergy.model';

export type PartialUpdateAllergy = Partial<IAllergy> & Pick<IAllergy, 'id'>;

type RestOf<T extends IAllergy | NewAllergy> = Omit<T, 'notedOn' | 'createdDate' | 'modifiedDate'> & {
  notedOn?: string | null;
  createdDate?: string | null;
  modifiedDate?: string | null;
};

export type RestAllergy = RestOf<IAllergy>;

export type NewRestAllergy = RestOf<NewAllergy>;

export type PartialUpdateRestAllergy = RestOf<PartialUpdateAllergy>;

export type EntityResponseType = HttpResponse<IAllergy>;
export type EntityArrayResponseType = HttpResponse<IAllergy[]>;

@Injectable({ providedIn: 'root' })
export class AllergyService {
  protected http = inject(HttpClient);
  protected applicationConfigService = inject(ApplicationConfigService);

  protected resourceUrl = this.applicationConfigService.getEndpointFor('api/allergies', 'hcpatientservice');

  create(allergy: NewAllergy): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(allergy);
    return this.http
      .post<RestAllergy>(this.resourceUrl, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  update(allergy: IAllergy): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(allergy);
    return this.http
      .put<RestAllergy>(`${this.resourceUrl}/${this.getAllergyIdentifier(allergy)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  partialUpdate(allergy: PartialUpdateAllergy): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(allergy);
    return this.http
      .patch<RestAllergy>(`${this.resourceUrl}/${this.getAllergyIdentifier(allergy)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  find(id: string): Observable<EntityResponseType> {
    return this.http
      .get<RestAllergy>(`${this.resourceUrl}/${id}`, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http
      .get<RestAllergy[]>(this.resourceUrl, { params: options, observe: 'response' })
      .pipe(map(res => this.convertResponseArrayFromServer(res)));
  }

  delete(id: string): Observable<HttpResponse<{}>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  getAllergyIdentifier(allergy: Pick<IAllergy, 'id'>): string {
    return allergy.id;
  }

  compareAllergy(o1: Pick<IAllergy, 'id'> | null, o2: Pick<IAllergy, 'id'> | null): boolean {
    return o1 && o2 ? this.getAllergyIdentifier(o1) === this.getAllergyIdentifier(o2) : o1 === o2;
  }

  addAllergyToCollectionIfMissing<Type extends Pick<IAllergy, 'id'>>(
    allergyCollection: Type[],
    ...allergiesToCheck: (Type | null | undefined)[]
  ): Type[] {
    const allergies: Type[] = allergiesToCheck.filter(isPresent);
    if (allergies.length > 0) {
      const allergyCollectionIdentifiers = allergyCollection.map(allergyItem => this.getAllergyIdentifier(allergyItem)!);
      const allergiesToAdd = allergies.filter(allergyItem => {
        const allergyIdentifier = this.getAllergyIdentifier(allergyItem);
        if (allergyCollectionIdentifiers.includes(allergyIdentifier)) {
          return false;
        }
        allergyCollectionIdentifiers.push(allergyIdentifier);
        return true;
      });
      return [...allergiesToAdd, ...allergyCollection];
    }
    return allergyCollection;
  }

  protected convertDateFromClient<T extends IAllergy | NewAllergy | PartialUpdateAllergy>(allergy: T): RestOf<T> {
    return {
      ...allergy,
      notedOn: allergy.notedOn?.format(DATE_FORMAT) ?? null,
      createdDate: allergy.createdDate?.format(DATE_FORMAT) ?? null,
      modifiedDate: allergy.modifiedDate?.format(DATE_FORMAT) ?? null,
    };
  }

  protected convertDateFromServer(restAllergy: RestAllergy): IAllergy {
    return {
      ...restAllergy,
      notedOn: restAllergy.notedOn ? dayjs(restAllergy.notedOn) : undefined,
      createdDate: restAllergy.createdDate ? dayjs(restAllergy.createdDate) : undefined,
      modifiedDate: restAllergy.modifiedDate ? dayjs(restAllergy.modifiedDate) : undefined,
    };
  }

  protected convertResponseFromServer(res: HttpResponse<RestAllergy>): HttpResponse<IAllergy> {
    return res.clone({
      body: res.body ? this.convertDateFromServer(res.body) : null,
    });
  }

  protected convertResponseArrayFromServer(res: HttpResponse<RestAllergy[]>): HttpResponse<IAllergy[]> {
    return res.clone({
      body: res.body ? res.body.map(item => this.convertDateFromServer(item)) : null,
    });
  }
}
