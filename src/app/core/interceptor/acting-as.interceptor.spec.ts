/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/core/interceptor/acting-as.interceptor.spec.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ActingAsService } from 'app/core/auth/acting-as.service';
import { ACTING_AS_HEADER, ActingAsInterceptor } from './acting-as.interceptor';

describe('ActingAsInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let actingAsService: ActingAsService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: ActingAsInterceptor, multi: true },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    actingAsService = TestBed.inject(ActingAsService);
  });

  afterEach(() => httpMock.verify());

  it('sends no header before a record has been chosen', () => {
    http.get('/api/profiles').subscribe();

    // The backend reads an absent header as "myself", which is what every request meant before delegation existed.
    expect(httpMock.expectOne('/api/profiles').request.headers.has(ACTING_AS_HEADER)).toBe(false);
  });

  it('puts the selected patient on every API request', () => {
    actingAsService.setAvailable([
      { patientId: 'me', name: 'Ama', own: true },
      { patientId: 'other', name: 'Kwesi', own: false },
    ]);
    actingAsService.select('other');

    http.get('/api/allergies').subscribe();
    http.get('/api/medications').subscribe();

    // Every request, not merely the ones a developer remembered. A call that omitted it would silently read the
    // wrong person's record and answer 200.
    expect(httpMock.expectOne('/api/allergies').request.headers.get(ACTING_AS_HEADER)).toBe('other');
    expect(httpMock.expectOne('/api/medications').request.headers.get(ACTING_AS_HEADER)).toBe('other');
  });

  it('leaves requests to other hosts alone', () => {
    actingAsService.setAvailable([{ patientId: 'other', name: 'Kwesi', own: false }]);

    http.get('https://example.test/thing').subscribe();

    // An internal header has no business on a third-party host.
    expect(httpMock.expectOne('https://example.test/thing').request.headers.has(ACTING_AS_HEADER)).toBe(false);
  });
});
