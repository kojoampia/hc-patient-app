import { HttpHeaders, HttpResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { IReport } from 'app/entities/patientMS/report/report.model';
import { ReportService } from 'app/entities/patientMS/report/service/report.service';

import { PatientContextService } from './patient-context.service';
import { PortalDataService } from './portal-data.service';
import { Resource, loaded } from './resource';

/**
 * That the portal reads a whole collection rather than its first page.
 *
 * Six of the api's patient collections are paginated — cases, reports, medications, visitations,
 * schedules and activity — and this service asked for none of them by page. Spring answers a
 * request carrying no `size` with its own default of 20, so a patient with 21 reports saw 20, with
 * a 200 and nothing in the console.
 *
 * §7.5's three states cannot catch this and it is worth saying why: a short page is `loaded`, not
 * `failed`. The stream is working exactly as designed and the answer is still wrong, which is the
 * one shape "give every stream three states" was never going to cover.
 *
 * These assert against the *request*, not against a row count. A row count alone passes whether the
 * fix is real or the fixture is small — which is how the defect survived, since every seeded
 * collection is under twenty.
 */
describe('PortalDataService — reading past the first page', () => {
  const report = (id: string): IReport => ({ id, patientId: 'patient-1' }) as IReport;

  const page = (rows: IReport[], total?: number): HttpResponse<IReport[]> =>
    new HttpResponse({
      body: rows,
      headers: total === undefined ? new HttpHeaders() : new HttpHeaders({ 'X-Total-Count': String(total) }),
    });

  let patientIdState$: BehaviorSubject<Resource<string | null>>;
  let query: jest.Mock;

  const build = (): PortalDataService => {
    patientIdState$ = new BehaviorSubject<Resource<string | null>>(loaded<string | null>('patient-1'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PatientContextService, useValue: { patientIdState$, reload: jest.fn() } },
        { provide: ReportService, useValue: { query } },
      ],
    });
    return TestBed.inject(PortalDataService);
  };

  it('asks for an explicit page size rather than accepting the server default', () => {
    query = jest.fn().mockReturnValue(of(page([report('r1')], 1)));
    build().reports$.subscribe();

    // The whole defect in one assertion. A request with no `size` is answered with 20 rows and a
    // 200, so every other check would pass while the screen was short.
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'patient-1', page: 0, size: 100 }));
  });

  it('fetches the remaining pages when the total exceeds the first', () => {
    const first = Array.from({ length: 100 }, (_unused, index) => report(`a${index}`));
    const second = Array.from({ length: 40 }, (_unused, index) => report(`b${index}`));
    query = jest.fn().mockImplementation((req: { page: number }) => of(req.page === 0 ? page(first, 140) : page(second, 140)));

    const seen: Resource<readonly IReport[]>[] = [];
    build().reports$.subscribe(value => seen.push(value));

    const last = seen[seen.length - 1];
    expect(last.state).toBe('loaded');
    expect(last.state === 'loaded' ? last.value : []).toHaveLength(140);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('makes one request when the endpoint sends no X-Total-Count', () => {
    // `stats` is unpaginated today and answers in full. Paging until a short page arrived would
    // stop here for the wrong reason, and would break the day that endpoint gains a Pageable.
    query = jest.fn().mockReturnValue(of(page([report('r1'), report('r2')])));

    const seen: Resource<readonly IReport[]>[] = [];
    build().reports$.subscribe(value => seen.push(value));

    const last = seen[seen.length - 1];
    expect(last.state === 'loaded' ? last.value : []).toHaveLength(2);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('stops at the page cap rather than trusting a wrong total', () => {
    // On a handset a runaway is not a slow tab, it is an app that stops responding.
    query = jest.fn().mockImplementation(() => of(page([report('r')], 10_000_000)));
    build().reports$.subscribe();

    expect(query).toHaveBeenCalledTimes(20);
  });

  it('still reports a failure as failed rather than as an empty collection', () => {
    // The property §7.5 exists for, re-pinned because the fetch now happens one method deeper and
    // a catchError in the wrong place would swallow it.
    query = jest.fn().mockReturnValue(throwError(() => new Error('connection dropped')));

    const seen: Resource<readonly IReport[]>[] = [];
    build().reports$.subscribe(value => seen.push(value));

    expect(seen[seen.length - 1].state).toBe('failed');
  });
});
