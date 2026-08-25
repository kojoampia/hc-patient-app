import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { ActingAsService } from 'app/core/auth/acting-as.service';

import { AccountDeletionPage } from './account-deletion.page';
import { DeletionRequest, DeletionRequestService } from '../data/deletion-request.service';

const PENDING: DeletionRequest = {
  id: 'req-1',
  patientId: 'ama-patient',
  status: 'PENDING',
  requestedAt: '2026-08-25T10:00:00Z',
  dueAt: '2026-09-08T10:00:00Z',
};

describe('DeletionRequestService', () => {
  let service: DeletionRequestService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DeletionRequestService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('goes to the patient service, not the gateway', () => {
    // The DeletionRequest lives with the clinical data it commissions the erasure of, so this call
    // carries the /services/hcpatientservice/ prefix — unlike registration and password reset.
    service.mine().subscribe();

    http.expectOne(req => req.url.includes('hcpatientservice') && req.url.endsWith('api/deletion-requests/mine')).flush(null);
  });

  it('reads a 204 as "no request open" rather than as an error', () => {
    // Having no pending deletion is the ordinary state of every account. If it travelled as an
    // error the screen would render a failure to almost everyone who opened it.
    let received: DeletionRequest | null | undefined;
    service.mine().subscribe(request => (received = request));

    http.expectOne(req => req.url.endsWith('/mine')).flush(null, { status: 204, statusText: 'No Content' });

    expect(received).toBeNull();
  });

  it('omits an empty reason rather than sending a blank one', () => {
    service.raise('   ').subscribe();

    const request = http.expectOne(req => req.method === 'POST' && req.url.endsWith('api/deletion-requests'));
    expect(request.request.body).toEqual({});
    request.flush(PENDING);
  });

  it('trims a reason that is given', () => {
    service.raise('  moving abroad  ').subscribe();

    const request = http.expectOne(req => req.method === 'POST' && req.url.endsWith('api/deletion-requests'));
    expect(request.request.body).toEqual({ reason: 'moving abroad' });
    request.flush(PENDING);
  });

  it('cancels by posting, never by DELETE', () => {
    // There is no client-side delete anywhere in this file and there must not be: erasure is
    // ROLE_ADMIN's, and a DELETE from here would 403 and be reported to a patient as a bug.
    service.cancel('req-1').subscribe();

    const request = http.expectOne(req => req.url.endsWith('api/deletion-requests/req-1/cancel'));
    expect(request.request.method).toBe('POST');
    request.flush({ ...PENDING, status: 'CANCELLED' });
  });
});

describe('AccountDeletionPage', () => {
  let component: AccountDeletionPage;
  let fixture: ComponentFixture<AccountDeletionPage>;
  let mine: jest.Mock;
  let raise: jest.Mock;
  let cancel: jest.Mock;
  let actingForSomeoneElse: jest.Mock;

  const build = (): void => {
    fixture = TestBed.createComponent(AccountDeletionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    mine = jest.fn().mockReturnValue(of(null));
    raise = jest.fn().mockReturnValue(of(PENDING));
    cancel = jest.fn().mockReturnValue(of({ ...PENDING, status: 'CANCELLED' }));
    actingForSomeoneElse = jest.fn().mockReturnValue(false);

    TestBed.configureTestingModule({
      imports: [AccountDeletionPage, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DeletionRequestService, useValue: { mine, raise, cancel } },
        { provide: ActingAsService, useValue: { actingForSomeoneElse } },
      ],
    });
  });

  it('asks for nothing on the first tap', () => {
    build();

    component.startConfirm();

    // The whole point of the two-step confirm: revealing the consequences must not BE the consent.
    expect(raise).not.toHaveBeenCalled();
    expect(component.confirming()).toBe(true);
  });

  it('records the request only on the second, differently worded action', () => {
    build();
    component.startConfirm();
    component.reason.set('moving abroad');

    component.confirm();

    expect(raise).toHaveBeenCalledWith('moving abroad');
    expect(component.pending()).toEqual(PENDING);
    expect(component.confirming()).toBe(false);
  });

  it('lets the patient back out of the confirm panel without asking for anything', () => {
    build();
    component.startConfirm();

    component.abandon();

    expect(component.confirming()).toBe(false);
    expect(raise).not.toHaveBeenCalled();
  });

  it('shows the pending request when one already exists', () => {
    mine.mockReturnValue(of(PENDING));

    build();

    expect(component.pending()).toEqual(PENDING);
  });

  it('withdraws a pending request and returns to the offer', () => {
    mine.mockReturnValue(of(PENDING));
    build();

    component.cancelRequest();

    expect(cancel).toHaveBeenCalledWith('req-1');
    expect(component.pending()).toBeNull();
  });

  it('reports a failed raise without pretending it worked', () => {
    // The dangerous failure is the opposite: a screen that says "scheduled for deletion" when the
    // request never reached the server, so the patient stops expecting anything to happen.
    raise.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    build();
    component.startConfirm();

    component.confirm();

    expect(component.actionError()).toBe('patientPortal.deleteAccount.error.raise');
    expect(component.pending()).toBeNull();
    expect(component.busy()).toBe(false);
  });

  it('reports a failed withdrawal, and keeps showing the request as pending', () => {
    // Equally: if the cancel did not land, the deletion IS still coming. Clearing it locally would
    // be the more comfortable lie.
    mine.mockReturnValue(of(PENDING));
    cancel.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    build();

    component.cancelRequest();

    expect(component.actionError()).toBe('patientPortal.deleteAccount.error.cancel');
    expect(component.pending()).toEqual(PENDING);
  });

  it('distinguishes a failed check from having no request', () => {
    // §7.5's rule, on the one screen where conflating them would tell a patient their deletion was
    // never requested.
    mine.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));

    build();

    expect(component.isFailed()).toBe(true);
    expect(component.pending()).toBeNull();
  });

  it('offers nothing while acting for another patient', () => {
    actingForSomeoneElse.mockReturnValue(true);

    build();

    // The server refuses it too (403). Both checks exist: this one so the app never offers a
    // control that would fail, that one so the refusal does not depend on the client.
    expect(component.actingForSomeoneElse()).toBe(true);
  });
});
