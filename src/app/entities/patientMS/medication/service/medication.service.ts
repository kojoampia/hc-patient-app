/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/medication/service/medication.service.ts @ 12e418c
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
import { IMedication, NewMedication } from '../medication.model';

export type PartialUpdateMedication = Partial<IMedication> & Pick<IMedication, 'id'>;

type RestOf<T extends IMedication | NewMedication> = Omit<T, 'startedOn' | 'createdDate' | 'modifiedDate'> & {
  startedOn?: string | null;
  createdDate?: string | null;
  modifiedDate?: string | null;
};

export type RestMedication = RestOf<IMedication>;

export type NewRestMedication = RestOf<NewMedication>;

export type PartialUpdateRestMedication = RestOf<PartialUpdateMedication>;

export type EntityResponseType = HttpResponse<IMedication>;
export type EntityArrayResponseType = HttpResponse<IMedication[]>;

@Injectable({ providedIn: 'root' })
export class MedicationService {
  protected http = inject(HttpClient);
  protected applicationConfigService = inject(ApplicationConfigService);

  protected resourceUrl = this.applicationConfigService.getEndpointFor('api/medications', 'hcpatientservice');

  create(medication: NewMedication): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(medication);
    return this.http
      .post<RestMedication>(this.resourceUrl, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  update(medication: IMedication): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(medication);
    return this.http
      .put<RestMedication>(`${this.resourceUrl}/${this.getMedicationIdentifier(medication)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  partialUpdate(medication: PartialUpdateMedication): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(medication);
    return this.http
      .patch<RestMedication>(`${this.resourceUrl}/${this.getMedicationIdentifier(medication)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  find(id: string): Observable<EntityResponseType> {
    return this.http
      .get<RestMedication>(`${this.resourceUrl}/${id}`, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http
      .get<RestMedication[]>(this.resourceUrl, { params: options, observe: 'response' })
      .pipe(map(res => this.convertResponseArrayFromServer(res)));
  }

  delete(id: string): Observable<HttpResponse<{}>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  getMedicationIdentifier(medication: Pick<IMedication, 'id'>): string {
    return medication.id;
  }

  compareMedication(o1: Pick<IMedication, 'id'> | null, o2: Pick<IMedication, 'id'> | null): boolean {
    return o1 && o2 ? this.getMedicationIdentifier(o1) === this.getMedicationIdentifier(o2) : o1 === o2;
  }

  addMedicationToCollectionIfMissing<Type extends Pick<IMedication, 'id'>>(
    medicationCollection: Type[],
    ...medicationsToCheck: (Type | null | undefined)[]
  ): Type[] {
    const medications: Type[] = medicationsToCheck.filter(isPresent);
    if (medications.length > 0) {
      const medicationCollectionIdentifiers = medicationCollection.map(medicationItem => this.getMedicationIdentifier(medicationItem)!);
      const medicationsToAdd = medications.filter(medicationItem => {
        const medicationIdentifier = this.getMedicationIdentifier(medicationItem);
        if (medicationCollectionIdentifiers.includes(medicationIdentifier)) {
          return false;
        }
        medicationCollectionIdentifiers.push(medicationIdentifier);
        return true;
      });
      return [...medicationsToAdd, ...medicationCollection];
    }
    return medicationCollection;
  }

  protected convertDateFromClient<T extends IMedication | NewMedication | PartialUpdateMedication>(medication: T): RestOf<T> {
    return {
      ...medication,
      startedOn: medication.startedOn?.format(DATE_FORMAT) ?? null,
      createdDate: medication.createdDate?.format(DATE_FORMAT) ?? null,
      modifiedDate: medication.modifiedDate?.format(DATE_FORMAT) ?? null,
    };
  }

  protected convertDateFromServer(restMedication: RestMedication): IMedication {
    return {
      ...restMedication,
      startedOn: restMedication.startedOn ? dayjs(restMedication.startedOn) : undefined,
      createdDate: restMedication.createdDate ? dayjs(restMedication.createdDate) : undefined,
      modifiedDate: restMedication.modifiedDate ? dayjs(restMedication.modifiedDate) : undefined,
    };
  }

  protected convertResponseFromServer(res: HttpResponse<RestMedication>): HttpResponse<IMedication> {
    return res.clone({
      body: res.body ? this.convertDateFromServer(res.body) : null,
    });
  }

  protected convertResponseArrayFromServer(res: HttpResponse<RestMedication[]>): HttpResponse<IMedication[]> {
    return res.clone({
      body: res.body ? res.body.map(item => this.convertDateFromServer(item)) : null,
    });
  }
}
