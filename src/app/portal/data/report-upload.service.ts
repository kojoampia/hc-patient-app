/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/report-upload.service.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import dayjs from 'dayjs/esm';

import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { IReport } from 'app/entities/patientMS/report/report.model';
import { ReportService } from 'app/entities/patientMS/report/service/report.service';

/** What the api accepts, and what the file picker should therefore offer. */
export const ACCEPTED_REPORT_TYPES = 'application/pdf,image/jpeg,image/png,image/heic';

/** Ten megabytes, the same limit the api enforces — checked here only to fail fast and kindly. */
export const MAX_REPORT_BYTES = 10 * 1024 * 1024;

/**
 * Filing a report the patient has themselves — a clinic PDF, or a photograph of a lab slip.
 *
 * <p>Two calls, not one: the report document is created first and the file is attached to it. That is the api's
 * shape, and it is the better failure mode — an upload that dies halfway leaves a report the patient can retry
 * against rather than nothing at all, and the record still says a report exists.</p>
 *
 * Kept beside the portal's other data services rather than added to the generated `ReportService`, which is a
 * JHipster regeneration point.
 */
@Injectable({ providedIn: 'root' })
export class ReportUploadService {
  private readonly http = inject(HttpClient);
  private readonly reports = inject(ReportService);
  private readonly applicationConfig = inject(ApplicationConfigService);

  /**
   * Creates the report and attaches the file.
   *
   * @param patientId whose record this belongs to.
   * @param details what the patient called it and, optionally, the case it relates to.
   * @param file the chosen file.
   */
  upload(patientId: string, details: { name: string; caseId: string | null; summary: string | null }, file: File): Observable<IReport> {
    return this.reports
      .create({
        id: null,
        name: details.name,
        summary: details.summary,
        caseId: details.caseId,
        patientId,
        category: 'Uploaded',
        reportDate: dayjs(),
      })
      .pipe(
        switchMap(created => {
          const report = created.body!;
          const form = new FormData();
          form.append('file', file);
          return this.http.post<IReport>(this.applicationConfig.getEndpointFor(`api/reports/${report.id}/file`, 'hcpatientservice'), form);
        }),
      );
  }

  /**
   * Fetches a report's file as a blob URL the browser can display.
   *
   * A plain `<a href>` cannot open one of these. The api requires a bearer token, a browser
   * navigation carries no headers, and the auth interceptor only sees requests this app makes — so
   * following the link produced a 401 error page. Nothing revealed it until a report actually had a
   * file: every seeded report has an empty `url`, so the button had never been pressed against a
   * real one.
   *
   * The caller is responsible for revoking the URL when it is finished with it.
   */
  open(url: string): Observable<string> {
    // The stored url is relative to the service, as the api writes it: `api/reports/{id}/file`.
    const endpoint = this.applicationConfig.getEndpointFor(url, 'hcpatientservice');
    return this.http.get(endpoint, { responseType: 'blob' }).pipe(map(blob => URL.createObjectURL(blob)));
  }

  /** Whether a file can be sent at all, so the patient hears about it before waiting for an upload. */
  reject(file: File): 'size' | null {
    return file.size > MAX_REPORT_BYTES ? 'size' : null;
  }
}
