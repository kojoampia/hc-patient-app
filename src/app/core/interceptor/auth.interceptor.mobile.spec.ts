/**
 * New in hc-patient-app — no origin in the web repo, and it could not have one.
 *
 * The lifted auth.interceptor.spec.ts sets `setEndpointPrefix('')` with the comment "Same-origin,
 * as every build now is." That is true of the web and FALSE HERE: a Capacitor webview is
 * https://localhost, nothing is same-origin, and SERVER_API_URL is absolute in every build
 * (patient-mobile.md §7.7.3). So the lifted spec exercises a configuration this app never runs in.
 *
 * These cases re-run the same rules under the prefix the app actually ships with. Phase 2's
 * acceptance criterion — **no Authorization header on /api/authenticate** — is the first of them,
 * and verifying it only under an empty prefix would not have proved it for the device.
 */

import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { StateStorageService } from 'app/core/auth/state-storage.service';
import { AuthInterceptor } from './auth.interceptor';

/** The shape SERVER_API_URL takes on a device: absolute, trailing slash. */
const API = 'https://patient.abofonsa.com/';
const TOKEN = 'a-stored-token';

describe('AuthInterceptor (absolute endpoint prefix — the mobile configuration)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let config: ApplicationConfigService;

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
    config = TestBed.inject(ApplicationConfigService);
    config.setEndpointPrefix(API);
  });

  afterEach(() => httpMock.verify());

  function authorizationFor(url: string): string | null {
    http.get(url).subscribe();
    const req = httpMock.expectOne(url);
    const header = req.request.headers.get('Authorization');
    req.flush({});
    return header;
  }

  /**
   * PHASE 2 ACCEPTANCE. Sending a token here does not merely waste bytes — Spring Security's bearer
   * filter runs before authorization, so an expired token fails the request outright and
   * `permitAll` never gets a say. Sign-in then answers 401 for a reason that has nothing to do with
   * the credentials, and retrying does the same thing.
   *
   * On a phone that is worse than on the web, because there is no "clear site data" to escape with.
   */
  it('sends NO Authorization to api/authenticate, built through getEndpointFor', () => {
    expect(authorizationFor(config.getEndpointFor('api/authenticate'))).toBeNull();
  });

  it.each(['api/register', 'api/activate', 'api/account/reset-password/init', 'api/account/username-available'])(
    'sends no Authorization to %s under an absolute prefix',
    path => {
      expect(authorizationFor(config.getEndpointFor(path))).toBeNull();
    },
  );

  it('still carries the token to an ordinary endpoint', () => {
    expect(authorizationFor(config.getEndpointFor('api/account'))).toBe(`Bearer ${TOKEN}`);
  });

  it('carries the token to the microservice segment', () => {
    expect(authorizationFor(config.getEndpointFor('api/profiles', 'hcpatientservice'))).toBe(`Bearer ${TOKEN}`);
  });

  /**
   * The reason the APP_INITIALIZER must resolve before any HTTP call. Nothing here is our own host,
   * so the token must not travel.
   */
  it('never sends the token to a third-party host', () => {
    expect(authorizationFor('https://example.com/api/account')).toBeNull();
  });

  /**
   * WHERE THE PLAN AND THE CODE DISAGREE, AND THE CODE WINS.
   *
   * patient-mobile.md §7.7.3 says that with an empty prefix the interceptors "attach to every host,
   * including third-party ones". That overstates it, and this test is why the claim should not be
   * relied on: the guard is
   *
   *     request.url.startsWith('http') && !(serverApiUrl && request.url.startsWith(serverApiUrl))
   *
   * and the `serverApiUrl &&` short-circuit is doing real work. With an empty prefix that operand
   * is `''` — falsy — so the whole condition is true and the request is passed through UNTOUCHED.
   * An unset prefix therefore does not leak the token to an absolute third-party URL.
   *
   * That short-circuit is the only thing standing between here and the leak the plan describes,
   * because every string starts with ''. Rewriting the guard as the "simpler"
   * `!request.url.startsWith(serverApiUrl)` would introduce exactly the defect §7.7.3 warns about.
   * This test pins the current behaviour so that rewrite fails.
   */
  it('does not leak the token cross-host even with an unset prefix (the && short-circuit)', () => {
    config.setEndpointPrefix('');

    expect(authorizationFor('https://example.com/api/account')).toBeNull();
  });

  /**
   * The real cost of an unset prefix on mobile, which is a different failure from the one the plan
   * describes: relative URLs resolve against the WEBVIEW's origin (https://localhost), so they hit
   * the app's own bundle instead of the gateway. The token is attached — correctly, since the URL
   * looks same-origin — but the request never reaches a backend.
   *
   * It fails as a 404 storm on first load rather than as a security problem, which is still a
   * reason the APP_INITIALIZER must resolve before anything fetches.
   */
  it('attaches the token to relative URLs, which an unset prefix turns into webview-local 404s', () => {
    config.setEndpointPrefix('');

    expect(config.getEndpointFor('api/account')).toBe('api/account');
    expect(authorizationFor('api/account')).toBe(`Bearer ${TOKEN}`);
  });
});
