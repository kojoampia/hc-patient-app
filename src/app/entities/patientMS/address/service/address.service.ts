/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/address/service/address.service.ts @ 12e418c
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
import { IAddress, NewAddress } from '../address.model';

export type PartialUpdateAddress = Partial<IAddress> & Pick<IAddress, 'id'>;

type RestOf<T extends IAddress | NewAddress> = Omit<T, 'createdDate' | 'modifiedDate'> & {
  createdDate?: string | null;
  modifiedDate?: string | null;
};

export type RestAddress = RestOf<IAddress>;

export type NewRestAddress = RestOf<NewAddress>;

export type PartialUpdateRestAddress = RestOf<PartialUpdateAddress>;

export type EntityResponseType = HttpResponse<IAddress>;
export type EntityArrayResponseType = HttpResponse<IAddress[]>;

@Injectable({ providedIn: 'root' })
export class AddressService {
  protected http = inject(HttpClient);
  protected applicationConfigService = inject(ApplicationConfigService);

  protected resourceUrl = this.applicationConfigService.getEndpointFor('api/addresses', 'hcpatientservice');

  create(address: NewAddress): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(address);
    return this.http
      .post<RestAddress>(this.resourceUrl, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  update(address: IAddress): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(address);
    return this.http
      .put<RestAddress>(`${this.resourceUrl}/${this.getAddressIdentifier(address)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  partialUpdate(address: PartialUpdateAddress): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(address);
    return this.http
      .patch<RestAddress>(`${this.resourceUrl}/${this.getAddressIdentifier(address)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  find(id: string): Observable<EntityResponseType> {
    return this.http
      .get<RestAddress>(`${this.resourceUrl}/${id}`, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http
      .get<RestAddress[]>(this.resourceUrl, { params: options, observe: 'response' })
      .pipe(map(res => this.convertResponseArrayFromServer(res)));
  }

  delete(id: string): Observable<HttpResponse<{}>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  getAddressIdentifier(address: Pick<IAddress, 'id'>): string {
    return address.id;
  }

  compareAddress(o1: Pick<IAddress, 'id'> | null, o2: Pick<IAddress, 'id'> | null): boolean {
    return o1 && o2 ? this.getAddressIdentifier(o1) === this.getAddressIdentifier(o2) : o1 === o2;
  }

  addAddressToCollectionIfMissing<Type extends Pick<IAddress, 'id'>>(
    addressCollection: Type[],
    ...addressesToCheck: (Type | null | undefined)[]
  ): Type[] {
    const addresses: Type[] = addressesToCheck.filter(isPresent);
    if (addresses.length > 0) {
      const addressCollectionIdentifiers = addressCollection.map(addressItem => this.getAddressIdentifier(addressItem)!);
      const addressesToAdd = addresses.filter(addressItem => {
        const addressIdentifier = this.getAddressIdentifier(addressItem);
        if (addressCollectionIdentifiers.includes(addressIdentifier)) {
          return false;
        }
        addressCollectionIdentifiers.push(addressIdentifier);
        return true;
      });
      return [...addressesToAdd, ...addressCollection];
    }
    return addressCollection;
  }

  protected convertDateFromClient<T extends IAddress | NewAddress | PartialUpdateAddress>(address: T): RestOf<T> {
    return {
      ...address,
      createdDate: address.createdDate?.format(DATE_FORMAT) ?? null,
      modifiedDate: address.modifiedDate?.format(DATE_FORMAT) ?? null,
    };
  }

  protected convertDateFromServer(restAddress: RestAddress): IAddress {
    return {
      ...restAddress,
      createdDate: restAddress.createdDate ? dayjs(restAddress.createdDate) : undefined,
      modifiedDate: restAddress.modifiedDate ? dayjs(restAddress.modifiedDate) : undefined,
    };
  }

  protected convertResponseFromServer(res: HttpResponse<RestAddress>): HttpResponse<IAddress> {
    return res.clone({
      body: res.body ? this.convertDateFromServer(res.body) : null,
    });
  }

  protected convertResponseArrayFromServer(res: HttpResponse<RestAddress[]>): HttpResponse<IAddress[]> {
    return res.clone({
      body: res.body ? res.body.map(item => this.convertDateFromServer(item)) : null,
    });
  }
}
