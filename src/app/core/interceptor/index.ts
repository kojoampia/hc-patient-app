/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/core/interceptor/index.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { ActingAsInterceptor } from 'app/core/interceptor/acting-as.interceptor';
import { AuthInterceptor } from 'app/core/interceptor/auth.interceptor';
import { AuthExpiredInterceptor } from 'app/core/interceptor/auth-expired.interceptor';
import { ErrorHandlerInterceptor } from 'app/core/interceptor/error-handler.interceptor';
import { NotificationInterceptor } from 'app/core/interceptor/notification.interceptor';

export const httpInterceptorProviders = [
  {
    provide: HTTP_INTERCEPTORS,
    useClass: AuthInterceptor,
    multi: true,
  },
  {
    // The only place X-Acting-As is ever set. See ActingAsInterceptor for why that matters.
    provide: HTTP_INTERCEPTORS,
    useClass: ActingAsInterceptor,
    multi: true,
  },
  {
    provide: HTTP_INTERCEPTORS,
    useClass: AuthExpiredInterceptor,
    multi: true,
  },
  {
    provide: HTTP_INTERCEPTORS,
    useClass: ErrorHandlerInterceptor,
    multi: true,
  },
  {
    provide: HTTP_INTERCEPTORS,
    useClass: NotificationInterceptor,
    multi: true,
  },
];
