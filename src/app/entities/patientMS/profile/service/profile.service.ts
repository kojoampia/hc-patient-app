/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/profile/service/profile.service.ts @ 12e418c
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
import { IProfile, NewProfile } from '../profile.model';

export type PartialUpdateProfile = Partial<IProfile> & Pick<IProfile, 'id'>;

type RestOf<T extends IProfile | NewProfile> = Omit<T, 'birthDate'> & {
  birthDate?: string | null;
};

export type RestProfile = RestOf<IProfile>;

export type NewRestProfile = RestOf<NewProfile>;

export type PartialUpdateRestProfile = RestOf<PartialUpdateProfile>;

export type EntityResponseType = HttpResponse<IProfile>;
export type EntityArrayResponseType = HttpResponse<IProfile[]>;

@Injectable({ providedIn: 'root' })
export class ProfileService {
  protected http = inject(HttpClient);
  protected applicationConfigService = inject(ApplicationConfigService);

  protected resourceUrl = this.applicationConfigService.getEndpointFor('api/profiles', 'hcpatientservice');

  create(profile: NewProfile): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(profile);
    return this.http
      .post<RestProfile>(this.resourceUrl, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  update(profile: IProfile): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(profile);
    return this.http
      .put<RestProfile>(`${this.resourceUrl}/${this.getProfileIdentifier(profile)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  partialUpdate(profile: PartialUpdateProfile): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(profile);
    return this.http
      .patch<RestProfile>(`${this.resourceUrl}/${this.getProfileIdentifier(profile)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  find(id: string): Observable<EntityResponseType> {
    return this.http
      .get<RestProfile>(`${this.resourceUrl}/${id}`, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http
      .get<RestProfile[]>(this.resourceUrl, { params: options, observe: 'response' })
      .pipe(map(res => this.convertResponseArrayFromServer(res)));
  }

  delete(id: string): Observable<HttpResponse<{}>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  getProfileIdentifier(profile: Pick<IProfile, 'id'>): string {
    return profile.id;
  }

  compareProfile(o1: Pick<IProfile, 'id'> | null, o2: Pick<IProfile, 'id'> | null): boolean {
    return o1 && o2 ? this.getProfileIdentifier(o1) === this.getProfileIdentifier(o2) : o1 === o2;
  }

  addProfileToCollectionIfMissing<Type extends Pick<IProfile, 'id'>>(
    profileCollection: Type[],
    ...profilesToCheck: (Type | null | undefined)[]
  ): Type[] {
    const profiles: Type[] = profilesToCheck.filter(isPresent);
    if (profiles.length > 0) {
      const profileCollectionIdentifiers = profileCollection.map(profileItem => this.getProfileIdentifier(profileItem)!);
      const profilesToAdd = profiles.filter(profileItem => {
        const profileIdentifier = this.getProfileIdentifier(profileItem);
        if (profileCollectionIdentifiers.includes(profileIdentifier)) {
          return false;
        }
        profileCollectionIdentifiers.push(profileIdentifier);
        return true;
      });
      return [...profilesToAdd, ...profileCollection];
    }
    return profileCollection;
  }

  protected convertDateFromClient<T extends IProfile | NewProfile | PartialUpdateProfile>(profile: T): RestOf<T> {
    return {
      ...profile,
      birthDate: profile.birthDate?.format(DATE_FORMAT) ?? null,
    };
  }

  protected convertDateFromServer(restProfile: RestProfile): IProfile {
    return {
      ...restProfile,
      birthDate: restProfile.birthDate ? dayjs(restProfile.birthDate) : undefined,
    };
  }

  protected convertResponseFromServer(res: HttpResponse<RestProfile>): HttpResponse<IProfile> {
    return res.clone({
      body: res.body ? this.convertDateFromServer(res.body) : null,
    });
  }

  protected convertResponseArrayFromServer(res: HttpResponse<RestProfile[]>): HttpResponse<IProfile[]> {
    return res.clone({
      body: res.body ? res.body.map(item => this.convertDateFromServer(item)) : null,
    });
  }
}
