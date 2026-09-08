/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/report/service/report.service.ts @ 12e418c
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
import { IReport, NewReport } from '../report.model';

export type PartialUpdateReport = Partial<IReport> & Pick<IReport, 'id'>;

type RestOf<T extends IReport | NewReport> = Omit<T, 'reportDate' | 'createdDate' | 'modifiedDate'> & {
  reportDate?: string | null;
  createdDate?: string | null;
  modifiedDate?: string | null;
};

export type RestReport = RestOf<IReport>;

export type NewRestReport = RestOf<NewReport>;

export type PartialUpdateRestReport = RestOf<PartialUpdateReport>;

export type EntityResponseType = HttpResponse<IReport>;
export type EntityArrayResponseType = HttpResponse<IReport[]>;

@Injectable({ providedIn: 'root' })
export class ReportService {
  protected http = inject(HttpClient);
  protected applicationConfigService = inject(ApplicationConfigService);

  protected resourceUrl = this.applicationConfigService.getEndpointFor('api/reports', 'hcpatientservice');

  create(report: NewReport): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(report);
    return this.http
      .post<RestReport>(this.resourceUrl, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  update(report: IReport): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(report);
    return this.http
      .put<RestReport>(`${this.resourceUrl}/${this.getReportIdentifier(report)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  partialUpdate(report: PartialUpdateReport): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(report);
    return this.http
      .patch<RestReport>(`${this.resourceUrl}/${this.getReportIdentifier(report)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  find(id: string): Observable<EntityResponseType> {
    return this.http
      .get<RestReport>(`${this.resourceUrl}/${id}`, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http
      .get<RestReport[]>(this.resourceUrl, { params: options, observe: 'response' })
      .pipe(map(res => this.convertResponseArrayFromServer(res)));
  }

  delete(id: string): Observable<HttpResponse<{}>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  getReportIdentifier(report: Pick<IReport, 'id'>): string {
    return report.id;
  }

  compareReport(o1: Pick<IReport, 'id'> | null, o2: Pick<IReport, 'id'> | null): boolean {
    return o1 && o2 ? this.getReportIdentifier(o1) === this.getReportIdentifier(o2) : o1 === o2;
  }

  addReportToCollectionIfMissing<Type extends Pick<IReport, 'id'>>(
    reportCollection: Type[],
    ...reportsToCheck: (Type | null | undefined)[]
  ): Type[] {
    const reports: Type[] = reportsToCheck.filter(isPresent);
    if (reports.length > 0) {
      const reportCollectionIdentifiers = reportCollection.map(reportItem => this.getReportIdentifier(reportItem)!);
      const reportsToAdd = reports.filter(reportItem => {
        const reportIdentifier = this.getReportIdentifier(reportItem);
        if (reportCollectionIdentifiers.includes(reportIdentifier)) {
          return false;
        }
        reportCollectionIdentifiers.push(reportIdentifier);
        return true;
      });
      return [...reportsToAdd, ...reportCollection];
    }
    return reportCollection;
  }

  protected convertDateFromClient<T extends IReport | NewReport | PartialUpdateReport>(report: T): RestOf<T> {
    return {
      ...report,
      reportDate: report.reportDate?.format(DATE_FORMAT) ?? null,
      createdDate: report.createdDate?.format(DATE_FORMAT) ?? null,
      modifiedDate: report.modifiedDate?.format(DATE_FORMAT) ?? null,
    };
  }

  protected convertDateFromServer(restReport: RestReport): IReport {
    return {
      ...restReport,
      reportDate: restReport.reportDate ? dayjs(restReport.reportDate) : undefined,
      createdDate: restReport.createdDate ? dayjs(restReport.createdDate) : undefined,
      modifiedDate: restReport.modifiedDate ? dayjs(restReport.modifiedDate) : undefined,
    };
  }

  protected convertResponseFromServer(res: HttpResponse<RestReport>): HttpResponse<IReport> {
    return res.clone({
      body: res.body ? this.convertDateFromServer(res.body) : null,
    });
  }

  protected convertResponseArrayFromServer(res: HttpResponse<RestReport[]>): HttpResponse<IReport[]> {
    return res.clone({
      body: res.body ? res.body.map(item => this.convertDateFromServer(item)) : null,
    });
  }
}
