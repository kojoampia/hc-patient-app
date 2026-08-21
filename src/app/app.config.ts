/**
 * New in hc-patient-app — the web's app.config.ts is an NgModule-era hybrid with ng-bootstrap,
 * Font Awesome, the service worker and OpenTelemetry in it, none of which apply here.
 */

import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { MissingTranslationHandler, TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { importProvidersFrom } from '@angular/core';

import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { DevicePreferencesService } from 'app/core/native/device-preferences.service';
import { SessionTokenService } from 'app/core/native/session-token.service';
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

  await Promise.all([sessionToken.unlock(), preferences.hydrate()]);
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
