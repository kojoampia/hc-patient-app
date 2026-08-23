import { HttpResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';

import { ClinicalCaseService } from 'app/entities/patientMS/clinical-case/service/clinical-case.service';
import { IClinicalCase } from 'app/entities/patientMS/clinical-case/clinical-case.model';
import { PatientContextService } from './patient-context.service';
import { PortalDataService } from './portal-data.service';
import { LOADING, Resource, loaded } from './resource';

/**
 * §7.5 says, of the `startWith(LOADING)` placement: **"Write the spec for exactly that."** This is
 * that spec.
 *
 * The two properties being pinned are easy to break by "tidying" the pipeline, and neither failure
 * is visible in a screenshot:
 *
 *  - moving `startWith` outside the switchMap makes it fire once on subscribe and never again, so a
 *    record switch leaves the previous patient's rows on screen under the new patient's name;
 *  - restoring `catchError(() => of([]))` makes a dropped connection render as "nothing recorded".
 */
describe('PortalDataService', () => {
  let patientIdState$: BehaviorSubject<Resource<string | null>>;
  let query: jest.Mock;

  const CASE = (id: string, patientId: string): IClinicalCase => ({ id, patientId }) as IClinicalCase;

  function build(): PortalDataService {
    TestBed.configureTestingModule({
      providers: [
        // PortalDataService injects all twelve entity services eagerly (they are field
        // initialisers), so the eleven this spec does not stub still have to be constructible.
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PatientContextService, useValue: { patientIdState$, reload: jest.fn() } },
        { provide: ClinicalCaseService, useValue: { query } },
      ],
    });
    return TestBed.inject(PortalDataService);
  }

  function collect<T>(source: Observable<T>): T[] {
    const seen: T[] = [];
    source.subscribe(value => seen.push(value));
    return seen;
  }

  beforeEach(() => {
    patientIdState$ = new BehaviorSubject<Resource<string | null>>(loaded('patient-kojo'));
    query = jest.fn().mockReturnValue(new Observable<HttpResponse<IClinicalCase[]>>());
  });

  describe('the three states', () => {
    it('always emits loading before a value', () => {
      query.mockReturnValue(new BehaviorSubject(new HttpResponse({ body: [CASE('c1', 'patient-kojo')] })));

      const seen = collect(build().cases$);

      expect(seen[0]).toEqual(LOADING);
      expect(seen[1]).toEqual(loaded([CASE('c1', 'patient-kojo')]));
    });

    /**
     * The headline defect. On the web this renders as "No allergies recorded" when the request never
     * arrived — and an allergy list is the worst possible place for those two to read alike.
     */
    it('reports a dropped connection as failed, NOT as an empty collection', () => {
      query.mockReturnValue(throwError(() => ({ status: 0 })));

      const seen = collect(build().cases$);

      expect(seen[seen.length - 1]).toEqual({ state: 'failed', status: 0, error: { status: 0 } });
      expect(seen).not.toContainEqual(loaded([]));
    });

    it('carries the status through so hpm-stream can word the message', () => {
      query.mockReturnValue(throwError(() => ({ status: 403 })));

      const seen = collect(build().cases$);

      expect(seen[seen.length - 1]).toMatchObject({ state: 'failed', status: 403 });
    });

    /** No record is not a failure. */
    it('emits loaded([]) when the patient has no record, rather than failing', () => {
      patientIdState$.next(loaded(null));

      const seen = collect(build().cases$);

      expect(seen[seen.length - 1]).toEqual(loaded([]));
      expect(query).not.toHaveBeenCalled();
    });

    it('passes the profile’s own loading and failed states straight through', () => {
      patientIdState$.next(LOADING as Resource<string | null>);
      const service = build();
      expect(collect(service.cases$).pop()).toEqual(LOADING);

      patientIdState$.next({ state: 'failed', status: 500, error: 'x' });
      expect(collect(service.cases$).pop()).toMatchObject({ state: 'failed', status: 500 });
    });
  });

  /**
   * THE DEFECT THE PLACEMENT FIXES.
   *
   * On the web, `shareReplay({ refCount: false })` keeps the previous patient's rows on screen for
   * the duration of the new request, under the new patient's name. The banner says one person and
   * the list shows another's records — which is precisely the failure §3 calls a safety control.
   */
  describe('switching records', () => {
    it('resets to loading, never showing the previous patient’s rows under the new name', () => {
      const kojo = new BehaviorSubject(new HttpResponse({ body: [CASE('c1', 'patient-kojo')] }));
      const ama = new Subject<HttpResponse<IClinicalCase[]>>();
      query.mockImplementation((req: { patientId: string }) => (req.patientId === 'patient-kojo' ? kojo : ama));

      const service = build();
      const seen = collect(service.cases$);
      expect(seen.pop()).toEqual(loaded([CASE('c1', 'patient-kojo')]));

      // The angel switches to a different patient. The new request has NOT answered yet.
      patientIdState$.next(loaded('patient-ama'));

      // The very next emission must be loading — not Kojo's case sitting under Ama's name.
      expect(seen.pop()).toEqual(LOADING);

      ama.next(new HttpResponse({ body: [CASE('c2', 'patient-ama')] }));
      expect(seen.pop()).toEqual(loaded([CASE('c2', 'patient-ama')]));
    });
  });

  /**
   * Defence in depth, unchanged from the web: the server gets `patientId` as a query parameter AND
   * the response is filtered again. A service that does not yet honour the parameter returns
   * everything, and the portal must not show one patient another's records because a backend was
   * behind.
   */
  describe('the double filter', () => {
    it('sends patientId to the server', () => {
      query.mockReturnValue(new BehaviorSubject(new HttpResponse({ body: [] })));

      build().cases$.subscribe();

      // includeArchived rides along on the case query specifically: the api hides archived cases
      // unless asked, and the portal splits one fetch into the live list, the archived list and the
      // by-id map.
      expect(query).toHaveBeenCalledWith({ patientId: 'patient-kojo', includeArchived: true });
    });

    it('discards rows the server should not have sent', () => {
      query.mockReturnValue(
        new BehaviorSubject(new HttpResponse({ body: [CASE('mine', 'patient-kojo'), CASE('theirs', 'patient-ama')] })),
      );

      const seen = collect(build().cases$);

      expect(seen.pop()).toEqual(loaded([CASE('mine', 'patient-kojo')]));
    });
  });
});
