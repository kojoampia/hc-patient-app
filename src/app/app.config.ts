/**
 * New in hc-patient-app — the web's app.config.ts is an NgModule-era hybrid with ng-bootstrap,
 * Font Awesome, the service worker and OpenTelemetry in it, none of which apply here.
 */

import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { MissingTranslationHandler, TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { importProvidersFrom } from '@angular/core';

import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { AppLifecycleService } from 'app/core/native/app-lifecycle.service';
import { DeepLinkService } from 'app/core/native/deep-link.service';
import { AppLockService } from 'app/core/native/app-lock.service';
import { BiometricsService } from 'app/core/native/biometrics.service';
import { DevicePreferencesService } from 'app/core/native/device-preferences.service';
import { SessionTokenService } from 'app/core/native/session-token.service';
import { StateStorageService } from 'app/core/auth/state-storage.service';
import { httpInterceptorProviders } from 'app/core/interceptor';
import { missingTranslationHandler, translatePartialLoader } from 'app/config/translation.config';
import { environment } from 'environments/environment';
import { routes } from './app.routes';

import 'app/config/dayjs';

/**
 * Startup, in the one order that works (patient-mobile.md §7.6, §7.7.3).
 *
 * 1. **Endpoint prefix first, and synchronously.** Both AuthInterceptor and ActingAsInterceptor
 *    decide whether to attach `Authorization` / `X-Acting-As` by comparing `request.url` against
 *    `getEndpointFor('')`. With an empty prefix that comparison matches EVERY host — so an HTTP
 *    call racing this line would attach the patient's bearer token to a third-party request. This
 *    is why it is the first statement and why it does not await anything.
 * 2. **Then the stored token**, because the §3.2 fork calls `/care-delegations/mine` and that needs
 *    a token in memory before the first request leaves.
 * 3. **Then preferences**, so `previousUrl` and `locale` read correctly on the first navigation.
 *
 * Steps 2 and 3 are independent of each other, so they run concurrently — but both must finish
 * before the initializer resolves, and nothing may fetch until it does.
 */
const initializeApp = async (): Promise<void> => {
  inject(ApplicationConfigService).setEndpointPrefix(environment.SERVER_API_URL);

  const sessionToken = inject(SessionTokenService);
  const preferences = inject(DevicePreferencesService);
  const biometrics = inject(BiometricsService);
  const lifecycle = inject(AppLifecycleService);
  const deepLinks = inject(DeepLinkService);
  const lock = inject(AppLockService);

  /**
   * EVERY inject() HAPPENS HERE, BEFORE THE FIRST await.
   *
   * The injection context does not survive an await — `inject()` after one throws NG0203, which
   * during an APP_INITIALIZER means bootstrap fails and the app renders a blank page. It is caught
   * by main.ts and logged, which is the only reason it is diagnosable at all; nothing else says
   * anything, and a blank cream screen looks like a styling problem rather than a crash.
   */
  const translate = inject(TranslateService);
  const stateStorage = inject(StateStorageService);

  const [, , security] = await Promise.all([sessionToken.unlock(), preferences.hydrate(), biometrics.check()]);

  /**
   * 4. **Whether this device may keep a token at all** (§7.6). A device with no screen lock does
   *    not get one written to disk — the session runs in memory and ends with the process, and the
   *    sign-in screen says so. Set BEFORE anything can sign in, or the first sign-in of a fresh
   *    install would persist under the default.
   */
  sessionToken.setDevicePersistable(security.deviceIsSecure);

  /**
   * 5. **Then the lock**, last, because it subscribes to `resumed$` and the very first thing that
   *    emits is a cold start — which locks if a token came back from the store. Wiring it before
   *    the token was read would race that decision.
   */
  lock.start();
  await lifecycle.start();

  /**
   * 5b. **Deep links**, after the lock, because a link can arrive while the app is locked and the
   *     route it asks for must not be shown behind the unlock screen. Attaching the listener later
   *     also means the cold-start decision above has already been made by the time one can fire.
   */
  await deepLinks.start();

  /**
   * 6. **Choose a language, or nothing is ever translated.**
   *
   * ngx-translate does not load a bundle until a language is selected, so without this every key
   * on every screen renders as `translation-not-found[login.title]` — literally, in the UI. The
   * only other `use()` in the app is in AccountService.identity(), which runs AFTER sign-in, so
   * the sign-in screen itself was never translated. Found on a device; no unit test sees it,
   * because TestBed specs use `TranslateModule.forRoot()` with no loader and assert on keys.
   *
   * The web does this in TranslationModule's constructor. That module is not lifted — this app
   * calls `TranslateModule.forRoot` directly — so its bootstrapping had to move here with it.
   *
   * Reads the stored locale so a language chosen on a previous run survives, which is why the CALL
   * sits here, after preferences have hydrated — while the injections that serve it happen above,
   * before the first await.
   */
  translate.setDefaultLang('en');
  translate.use(stateStorage.getLocale() ?? 'en');
};

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),

    /**
     * `withInterceptorsFromDi()` rather than `withInterceptors()`: the five interceptors are lifted
     * verbatim as class-based `HttpInterceptor`s registered through HTTP_INTERCEPTORS, and keeping
     * them that way is what makes them re-syncable against the web repo. Converting them to
     * functional interceptors would be a divergence with no benefit.
     */
    provideHttpClient(withInterceptorsFromDi()),
    httpInterceptorProviders,

    importProvidersFrom(
      TranslateModule.forRoot({
        loader: { provide: TranslateLoader, useFactory: translatePartialLoader, deps: [HttpClient] },
        missingTranslationHandler: { provide: MissingTranslationHandler, useFactory: missingTranslationHandler },
      }),
    ),

    provideAppInitializer(initializeApp),

    {
      provide: LOCALE_ID,
      useFactory: (translate: TranslateService) => translate.currentLang || 'en',
      deps: [TranslateService],
    },
  ],
};
