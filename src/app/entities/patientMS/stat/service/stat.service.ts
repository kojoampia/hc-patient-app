/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/stat/service/stat.service.ts @ 12e418c
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
import { IStat, NewStat } from '../stat.model';

export type PartialUpdateStat = Partial<IStat> & Pick<IStat, 'id'>;

type RestOf<T extends IStat | NewStat> = Omit<T, 'recordedAt' | 'createdDate'> & {
  recordedAt?: string | null;
  createdDate?: string | null;
};

export type RestStat = RestOf<IStat>;

export type NewRestStat = RestOf<NewStat>;

export type PartialUpdateRestStat = RestOf<PartialUpdateStat>;

export type EntityResponseType = HttpResponse<IStat>;
export type EntityArrayResponseType = HttpResponse<IStat[]>;

@Injectable({ providedIn: 'root' })
export class StatService {
  protected http = inject(HttpClient);
  protected applicationConfigService = inject(ApplicationConfigService);

  protected resourceUrl = this.applicationConfigService.getEndpointFor('api/stats', 'hcpatientservice');


  create(stat: NewStat): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(stat);
    return this.http.post<RestStat>(this.resourceUrl, copy, { observe: 'response' }).pipe(map(res => this.convertResponseFromServer(res)));
  }

  update(stat: IStat): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(stat);
    return this.http
      .put<RestStat>(`${this.resourceUrl}/${this.getStatIdentifier(stat)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  partialUpdate(stat: PartialUpdateStat): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(stat);
    return this.http
      .patch<RestStat>(`${this.resourceUrl}/${this.getStatIdentifier(stat)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  find(id: string): Observable<EntityResponseType> {
    return this.http
      .get<RestStat>(`${this.resourceUrl}/${id}`, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http
      .get<RestStat[]>(this.resourceUrl, { params: options, observe: 'response' })
      .pipe(map(res => this.convertResponseArrayFromServer(res)));
  }

  delete(id: string): Observable<HttpResponse<{}>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  getStatIdentifier(stat: Pick<IStat, 'id'>): string {
    return stat.id;
  }

  compareStat(o1: Pick<IStat, 'id'> | null, o2: Pick<IStat, 'id'> | null): boolean {
    return o1 && o2 ? this.getStatIdentifier(o1) === this.getStatIdentifier(o2) : o1 === o2;
  }

  addStatToCollectionIfMissing<Type extends Pick<IStat, 'id'>>(
    statCollection: Type[],
    ...statsToCheck: (Type | null | undefined)[]
  ): Type[] {
    const stats: Type[] = statsToCheck.filter(isPresent);
    if (stats.length > 0) {
      const statCollectionIdentifiers = statCollection.map(statItem => this.getStatIdentifier(statItem)!);
      const statsToAdd = stats.filter(statItem => {
        const statIdentifier = this.getStatIdentifier(statItem);
        if (statCollectionIdentifiers.includes(statIdentifier)) {
          return false;
        }
        statCollectionIdentifiers.push(statIdentifier);
        return true;
      });
      return [...statsToAdd, ...statCollection];
    }
    return statCollection;
  }

  protected convertDateFromClient<T extends IStat | NewStat | PartialUpdateStat>(stat: T): RestOf<T> {
    return {
      ...stat,
      recordedAt: stat.recordedAt?.toJSON() ?? null,
      createdDate: stat.createdDate?.format(DATE_FORMAT) ?? null,
    };
  }

  protected convertDateFromServer(restStat: RestStat): IStat {
    return {
      ...restStat,
      recordedAt: restStat.recordedAt ? dayjs(restStat.recordedAt) : undefined,
      createdDate: restStat.createdDate ? dayjs(restStat.createdDate) : undefined,
    };
  }

  protected convertResponseFromServer(res: HttpResponse<RestStat>): HttpResponse<IStat> {
    return res.clone({
      body: res.body ? this.convertDateFromServer(res.body) : null,
    });
  }

  protected convertResponseArrayFromServer(res: HttpResponse<RestStat[]>): HttpResponse<IStat[]> {
    return res.clone({
      body: res.body ? res.body.map(item => this.convertDateFromServer(item)) : null,
    });
  }
}
