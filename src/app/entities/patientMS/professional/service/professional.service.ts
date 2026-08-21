/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/professional/service/professional.service.ts @ 12e418c
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
import { IProfessional, NewProfessional } from '../professional.model';

export type PartialUpdateProfessional = Partial<IProfessional> & Pick<IProfessional, 'id'>;

type RestOf<T extends IProfessional | NewProfessional> = Omit<T, 'createdDate' | 'modifiedDate'> & {
  createdDate?: string | null;
  modifiedDate?: string | null;
};

export type RestProfessional = RestOf<IProfessional>;

export type NewRestProfessional = RestOf<NewProfessional>;

export type PartialUpdateRestProfessional = RestOf<PartialUpdateProfessional>;

export type EntityResponseType = HttpResponse<IProfessional>;
export type EntityArrayResponseType = HttpResponse<IProfessional[]>;

@Injectable({ providedIn: 'root' })
export class ProfessionalService {
  protected http = inject(HttpClient);
  protected applicationConfigService = inject(ApplicationConfigService);

  protected resourceUrl = this.applicationConfigService.getEndpointFor('api/professionals', 'hcpatientservice');


  create(professional: NewProfessional): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(professional);
    return this.http
      .post<RestProfessional>(this.resourceUrl, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  update(professional: IProfessional): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(professional);
    return this.http
      .put<RestProfessional>(`${this.resourceUrl}/${this.getProfessionalIdentifier(professional)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  partialUpdate(professional: PartialUpdateProfessional): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(professional);
    return this.http
      .patch<RestProfessional>(`${this.resourceUrl}/${this.getProfessionalIdentifier(professional)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  find(id: string): Observable<EntityResponseType> {
    return this.http
      .get<RestProfessional>(`${this.resourceUrl}/${id}`, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http
      .get<RestProfessional[]>(this.resourceUrl, { params: options, observe: 'response' })
      .pipe(map(res => this.convertResponseArrayFromServer(res)));
  }

  delete(id: string): Observable<HttpResponse<{}>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  getProfessionalIdentifier(professional: Pick<IProfessional, 'id'>): string {
    return professional.id;
  }

  compareProfessional(o1: Pick<IProfessional, 'id'> | null, o2: Pick<IProfessional, 'id'> | null): boolean {
    return o1 && o2 ? this.getProfessionalIdentifier(o1) === this.getProfessionalIdentifier(o2) : o1 === o2;
  }

  addProfessionalToCollectionIfMissing<Type extends Pick<IProfessional, 'id'>>(
    professionalCollection: Type[],
    ...professionalsToCheck: (Type | null | undefined)[]
  ): Type[] {
    const professionals: Type[] = professionalsToCheck.filter(isPresent);
    if (professionals.length > 0) {
      const professionalCollectionIdentifiers = professionalCollection.map(
        professionalItem => this.getProfessionalIdentifier(professionalItem)!,
      );
      const professionalsToAdd = professionals.filter(professionalItem => {
        const professionalIdentifier = this.getProfessionalIdentifier(professionalItem);
        if (professionalCollectionIdentifiers.includes(professionalIdentifier)) {
          return false;
        }
        professionalCollectionIdentifiers.push(professionalIdentifier);
        return true;
      });
      return [...professionalsToAdd, ...professionalCollection];
    }
    return professionalCollection;
  }

  protected convertDateFromClient<T extends IProfessional | NewProfessional | PartialUpdateProfessional>(professional: T): RestOf<T> {
    return {
      ...professional,
      createdDate: professional.createdDate?.format(DATE_FORMAT) ?? null,
      modifiedDate: professional.modifiedDate?.format(DATE_FORMAT) ?? null,
    };
  }

  protected convertDateFromServer(restProfessional: RestProfessional): IProfessional {
    return {
      ...restProfessional,
      createdDate: restProfessional.createdDate ? dayjs(restProfessional.createdDate) : undefined,
      modifiedDate: restProfessional.modifiedDate ? dayjs(restProfessional.modifiedDate) : undefined,
    };
  }

  protected convertResponseFromServer(res: HttpResponse<RestProfessional>): HttpResponse<IProfessional> {
    return res.clone({
      body: res.body ? this.convertDateFromServer(res.body) : null,
    });
  }

  protected convertResponseArrayFromServer(res: HttpResponse<RestProfessional[]>): HttpResponse<IProfessional[]> {
    return res.clone({
      body: res.body ? res.body.map(item => this.convertDateFromServer(item)) : null,
    });
  }
}
