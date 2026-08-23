import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';

import { LoginService } from 'app/login/login.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let component: LoginPage;
  let loginService: { login: jest.Mock; logout: jest.Mock };

  beforeEach(async () => {
    loginService = { login: jest.fn(), logout: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginPage, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: LoginService, useValue: loginService }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * §6 decision 5. The web renders a "remember me" checkbox because a shared desktop browser is a
   * real scenario; here the value is forced and the control is not offered. Both halves matter — a
   * rendered control whose value is ignored is worse than no control.
   */
  describe('rememberMe', () => {
    it('is true without the user being asked', () => {
      expect(component.loginForm.getRawValue().rememberMe).toBe(true);
    });

    it('renders no checkbox for it', () => {
      const host: HTMLElement = fixture.nativeElement;

      expect(host.querySelector('input[type="checkbox"]')).toBeNull();
      expect(host.querySelector('ion-checkbox')).toBeNull();
      expect(host.querySelector('.hc-auth-remember')).toBeNull();
    });

    it('submits rememberMe true to LoginService', () => {
      loginService.login.mockReturnValue(of(null));
      component.loginForm.setValue({ username: 'kojo', password: 'pw', rememberMe: true });

      component.login();

      expect(loginService.login).toHaveBeenCalledWith(expect.objectContaining({ username: 'kojo', password: 'pw', rememberMe: true }));
    });
  });

  describe('submission', () => {
    it('does nothing while the form is invalid', () => {
      component.login();

      expect(loginService.login).not.toHaveBeenCalled();
    });

    it('surfaces an authentication error without clearing what was typed', () => {
      loginService.login.mockReturnValue(throwError(() => new Error('401')));
      component.loginForm.setValue({ username: 'kojo', password: 'wrong', rememberMe: true });

      component.login();

      expect(component.authenticationError()).toBe(true);
      expect(component.submitting()).toBe(false);
      // Re-typing a username on a phone keyboard after a typo in the password is a good way to lose
      // somebody at the sign-in screen.
      expect(component.loginForm.getRawValue().username).toBe('kojo');
    });

    it('does not submit twice while a request is in flight', () => {
      // NEVER, so the request stays in flight and `submitting` stays true across both calls.
      loginService.login.mockReturnValue(NEVER);
      component.loginForm.setValue({ username: 'kojo', password: 'pw', rememberMe: true });

      component.login();
      component.login();

      expect(loginService.login).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * The password must be maskable. A phone keyboard with autocorrect on a visible password field is
   * how people end up locked out; the toggle is Ionic's, but its presence is ours to guarantee.
   */
  it('renders a password field with a visibility toggle', () => {
    const host: HTMLElement = fixture.nativeElement;
    const password = host.querySelector('ion-input[type="password"]');

    expect(password).not.toBeNull();
    expect(password!.querySelector('ion-input-password-toggle')).not.toBeNull();
  });

  it('does not disable autocomplete on the username, so a password manager can fill it', () => {
    const host: HTMLElement = fixture.nativeElement;
    const username = host.querySelector('ion-input#username');

    expect(username?.getAttribute('autocomplete')).toBe('username');
  });
});
