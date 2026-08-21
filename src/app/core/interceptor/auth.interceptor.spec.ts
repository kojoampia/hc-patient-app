/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/core/interceptor/auth.interceptor.spec.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import { TestBed } from '@angular/core/testing';
import { HttpClient, HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { StateStorageService } from 'app/core/auth/state-storage.service';

import { AuthInterceptor } from './auth.interceptor';

/**
 * The lockout these cover: Spring Security's bearer filter runs before authorization, so an expired
 * token on `/api/authenticate` fails the request before `permitAll` is consulted. Sign-in answers
 * 401 for a reason unrelated to the credentials, and since the stored token is what caused it,
 * trying again does the same. Clearing site data by hand was the only way back in.
 */
describe('AuthInterceptor', () => {
  const TOKEN = 'a-stored-token';
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: StateStorageService, useValue: { getAuthenticationToken: () => TOKEN } },
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    // Same-origin, as every build now is.
    TestBed.inject(ApplicationConfigService).setEndpointPrefix('');
  });

  afterEach(() => httpMock.verify());

  function expectAuthorization(url: string, expected: string | null): void {
    http.get(url).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBe(expected);
    req.flush({});
  }

  describe('endpoints that exist to get you a token', () => {
    it.each([
      'api/authenticate',
      'api/register',
      'api/activate',
      'api/account/reset-password/init',
      'api/account/reset-password/finish',
      'api/account/username-available',
    ])('sends no Authorization to %s', url => {
      expectAuthorization(url, null);
    });

    it('ignores a query string when deciding', () => {
      expectAuthorization('api/account/username-available?login=kojo', null);
    });

    it('recognises the same endpoint given as an absolute same-origin URL', () => {
      expectAuthorization('http://localhost/api/authenticate', null);
    });
  });

  describe('everything else', () => {
    it('still carries the token', () => {
      expectAuthorization('api/profiles', `Bearer ${TOKEN}`);
    });

    it('carries it on the microservice segment too', () => {
      expectAuthorization('services/hcpatientservice/api/clinical-cases', `Bearer ${TOKEN}`);
    });

    it('does not match an endpoint that merely contains an anonymous path as a word', () => {
      // `api/authenticated-users` is not `api/authenticate`.
      expectAuthorization('api/authenticated-users', `Bearer ${TOKEN}`);
    });
  });
});
