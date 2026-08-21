/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/core/interceptor/error-handler.interceptor.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpErrorResponse, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { EventManager, EventWithContent } from 'app/core/util/event-manager.service';

@Injectable()
export class ErrorHandlerInterceptor implements HttpInterceptor {
  constructor(private eventManager: EventManager) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      tap({
        error: (err: HttpErrorResponse) => {
          if (!(err.status === 401 && (err.message === '' || err.url?.includes('api/account')))) {
            this.eventManager.broadcast(new EventWithContent('patientGatewayApp.httpError', err));
          }
        },
      }),
    );
  }
}
