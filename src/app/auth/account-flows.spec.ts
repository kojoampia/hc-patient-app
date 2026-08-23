import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { DeepLinkService } from 'app/core/native/deep-link.service';

import { AccountApiService } from './account-api.service';
import { RegisterPage } from './register/register.page';
import { PasswordResetRequestPage } from './password-reset/password-reset-request.page';
import { PasswordResetFinishPage } from './password-reset/password-reset-finish.page';

describe('AccountApiService', () => {
  let service: AccountApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AccountApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the reset request as a bare string, not JSON', () => {
    // The gateway takes @RequestBody String. A JSON object arrives as a literal brace-wrapped
    // string, matches no account, and fails as "no such user" rather than as a bad request.
    service.requestReset('kojo@jac.net').subscribe();

    const request = http.expectOne(req => req.url.endsWith('api/account/reset-password/init'));
    expect(request.request.body).toBe('kojo@jac.net');
    request.flush({});
  });

  it('posts registration and the reset finish to the gateway, not the api', () => {
    // No /services/hcpatientservice/ prefix: the gateway is the only service with a User domain.
    service.register({ login: 'kojo', email: 'kojo@jac.net', password: 'secret', langKey: 'en' }).subscribe();
    http.expectOne(req => req.url.endsWith('api/register') && !req.url.includes('hcpatientservice')).flush({});

    service.finishReset('the-key', 'secret').subscribe();
    const finish = http.expectOne(req => req.url.endsWith('api/account/reset-password/finish'));
    expect(finish.request.body).toEqual({ key: 'the-key', newPassword: 'secret' });
    finish.flush({});
  });
});

describe('RegisterPage', () => {
  let register: jest.Mock;
  let component: RegisterPage;
  let fixture: ComponentFixture<RegisterPage>;

  const fill = (over: Partial<Record<'login' | 'email' | 'password' | 'confirm', string>> = {}): void => {
    component.form.setValue({ login: 'kojo', email: 'kojo@jac.net', password: 'secret', confirm: 'secret', ...over });
  };

  beforeEach(() => {
    register = jest.fn().mockReturnValue(of({}));
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), RegisterPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AccountApiService, useValue: { register } },
      ],
    });
    fixture = TestBed.createComponent(RegisterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('refuses to submit when the confirmation does not match', () => {
    fill({ confirm: 'different' });

    component.register();

    expect(register).not.toHaveBeenCalled();
  });

  it('trims the login and the email, which people paste with spaces', () => {
    fill({ login: '  kojo  ', email: ' kojo@jac.net ' });

    component.register();

    expect(register).toHaveBeenCalledWith(expect.objectContaining({ login: 'kojo', email: 'kojo@jac.net' }));
  });

  it('reports a taken login as its own message rather than a generic failure', () => {
    register.mockReturnValue(throwError(() => new HttpErrorResponse({ error: { errorKey: 'userexists' }, status: 400 })));
    fill();

    component.register();

    expect(component.errorKey()).toBe('userexists');
  });

  it('falls back to the generic failure for anything it does not recognise', () => {
    // Never a raw error string on screen: a patient cannot use "HttpErrorResponse 500".
    register.mockReturnValue(throwError(() => new HttpErrorResponse({ error: {}, status: 500 })));
    fill();

    component.register();

    expect(component.errorKey()).toBe('fail');
  });
});

describe('PasswordResetRequestPage', () => {
  let requestReset: jest.Mock;
  let component: PasswordResetRequestPage;

  beforeEach(() => {
    requestReset = jest.fn().mockReturnValue(of({}));
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), PasswordResetRequestPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AccountApiService, useValue: { requestReset } },
      ],
    });
    const fixture = TestBed.createComponent(PasswordResetRequestPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('says the same thing whether or not the address has an account', () => {
    // The gateway answers 200 either way so this screen cannot be used to find out who has an
    // account. Reporting a failure would hand back exactly the signal the server declines to give.
    requestReset.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    component.form.setValue({ email: 'nobody@example.test' });

    component.request();

    expect(component.success()).toBe(true);
  });
});

describe('PasswordResetFinishPage', () => {
  let finishReset: jest.Mock;

  const build = (key: string | null): PasswordResetFinishPage => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), PasswordResetFinishPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AccountApiService, useValue: { finishReset } },
        // After provideRouter, so this wins: the key is what the screen is about.
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(key ? { key } : {}) } } },
      ],
    });
    const fixture = TestBed.createComponent(PasswordResetFinishPage);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(() => {
    finishReset = jest.fn().mockReturnValue(of({}));
  });

  it('treats a missing key as its own state, not a form error', () => {
    // Somebody here without a key opened the app rather than following the mail, and that is what
    // the screen should say.
    expect(build(null).key()).toBeNull();
  });

  it('sends the key from the link', () => {
    const component = build('from-the-mail');
    component.form.setValue({ password: 'secret', confirm: 'secret' });

    component.finish();

    expect(finishReset).toHaveBeenCalledWith('from-the-mail', 'secret');
  });

  it('reports a stale key rather than a status nobody can act on', () => {
    finishReset = jest.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    const component = build('expired');
    component.form.setValue({ password: 'secret', confirm: 'secret' });

    component.finish();

    expect(component.failed()).toBe(true);
  });
});

describe('DeepLinkService', () => {
  let navigate: jest.Mock;
  let service: DeepLinkService;

  beforeEach(() => {
    navigate = jest.fn();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigate } }] });
    service = TestBed.inject(DeepLinkService);
  });

  it('routes the reset link and carries the key across', () => {
    service.open('https://patient.abofonsa.com/account/reset/finish?key=abc123');

    expect(navigate).toHaveBeenCalledWith(['/reset-password/finish'], { queryParams: { key: 'abc123' } });
  });

  it('ignores a link to a page this app does not have', () => {
    // The intent filter claims every link on the host, so without the allowlist a link to any web
    // page would be swallowed by an app with no such screen.
    service.open('https://patient.abofonsa.com/some/web/page');

    expect(navigate).not.toHaveBeenCalled();
  });

  it('survives a malformed link', () => {
    service.open('not a url');

    expect(navigate).not.toHaveBeenCalled();
  });
});
