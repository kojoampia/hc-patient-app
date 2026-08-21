/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/core/auth/auth-jwt.service.spec.ts @ 12e418c
 * Divergence: the two "read the token back out of web storage" cases are replaced. They asserted
 *   the web's localStorage/sessionStorage mechanism, which is exactly what §7.6 removed — on a
 *   device the token lives in the secure store behind SessionTokenService's in-memory signal. The
 *   replacements assert the mobile contract, including the stronger negative: a value sitting in
 *   web storage must grant nothing at all.
 * Re-sync: see PROVENANCE.md.
 */

import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthServerProvider } from 'app/core/auth/auth-jwt.service';
import { SessionTokenService } from 'app/core/native/session-token.service';
import { StateStorageService } from './state-storage.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('Auth JWT', () => {
  let service: AuthServerProvider;
  let httpMock: HttpTestingController;
  let mockStorageService: StateStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});

    mockStorageService = TestBed.inject(StateStorageService);
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AuthServerProvider);
  });

  describe('Get Token', () => {
    it('should return empty token if not found in local storage nor session storage', () => {
      const result = service.getToken();
      expect(result).toEqual('');
    });

    it('should return the token held by SessionTokenService', async () => {
      await TestBed.inject(SessionTokenService).persist('secureStoreToken');

      expect(service.getToken()).toEqual('secureStoreToken');
    });

    /**
     * The negative half, and the more important one. On the web a token in either web storage
     * authenticated the user; here neither is consulted. If this ever passes a token through again,
     * a value left behind by an older build — or by anything else on the same origin — would
     * silently sign somebody in.
     */
    it('should ignore tokens sitting in localStorage or sessionStorage', () => {
      sessionStorage.setItem('jhi-authenticationToken', JSON.stringify('sessionStorageToken'));
      localStorage.setItem('jhi-authenticationToken', JSON.stringify('localStorageToken'));

      expect(service.getToken()).toEqual('');
    });

    it('should forget the token on signOut', async () => {
      const sessionToken = TestBed.inject(SessionTokenService);
      await sessionToken.persist('secureStoreToken');

      await sessionToken.signOut();

      expect(service.getToken()).toEqual('');
    });
  });

  describe('Login', () => {
    it('should clear session storage and save in local storage when rememberMe is true', () => {
      // GIVEN
      mockStorageService.storeAuthenticationToken = jest.fn();

      // WHEN
      service.login({ username: 'John', password: '123', rememberMe: true }).subscribe();
      httpMock.expectOne('api/authenticate').flush({ id_token: '1' });

      // THEN
      httpMock.verify();
      expect(mockStorageService.storeAuthenticationToken).toHaveBeenCalledWith('1', true);
    });

    it('should clear local storage and save in session storage when rememberMe is false', () => {
      // GIVEN
      mockStorageService.storeAuthenticationToken = jest.fn();

      // WHEN
      service.login({ username: 'John', password: '123', rememberMe: false }).subscribe();
      httpMock.expectOne('api/authenticate').flush({ id_token: '1' });

      // THEN
      httpMock.verify();
      expect(mockStorageService.storeAuthenticationToken).toHaveBeenCalledWith('1', false);
    });
  });

  describe('Logout', () => {
    it('should clear storage', () => {
      // GIVEN
      mockStorageService.clearAuthenticationToken = jest.fn();

      // WHEN
      service.logout().subscribe();

      // THEN
      expect(mockStorageService.clearAuthenticationToken).toHaveBeenCalled();
    });
  });
});
