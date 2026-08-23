import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { AccountService } from 'app/core/auth/account.service';
import { ActingAsService } from 'app/core/auth/acting-as.service';
import { Authority } from 'app/config/authority.constants';

import { ActingAsBannerComponent } from './acting-as-banner.component';

/**
 * Which way out the banner offers, and to whom.
 *
 * The two are not the same question and were conflated once: switching picks from records already
 * held, finding reaches one that is not. An administrator has exactly one record open and nothing
 * to switch to, so offering only the switcher left them with no route to a second patient short of
 * signing out.
 */
describe('ActingAsBannerComponent', () => {
  let hasAnyAuthority: jest.Mock;
  let actingAs: ActingAsService;
  let fixture: ComponentFixture<ActingAsBannerComponent>;

  const build = (): ActingAsBannerComponent => {
    fixture = TestBed.createComponent(ActingAsBannerComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(() => {
    hasAnyAuthority = jest.fn().mockReturnValue(false);
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), ActingAsBannerComponent],
      providers: [{ provide: AccountService, useValue: { hasAnyAuthority } }],
    });
    actingAs = TestBed.inject(ActingAsService);
  });

  it('offers no switch to somebody holding one record', () => {
    actingAs.setAvailable([{ patientId: 'me', name: 'Kojo', own: true }]);

    expect(build().canSwitch()).toBe(false);
  });

  it('offers a switch once there is something to switch to', () => {
    actingAs.setAvailable([
      { patientId: 'me', name: 'Kojo', own: true },
      { patientId: 'other', name: 'Ama', own: false },
    ]);

    expect(build().canSwitch()).toBe(true);
  });

  it('offers the finder to an administrator holding a single record', () => {
    // The case the switcher cannot serve: one choice, and the patient they want is not in it.
    hasAnyAuthority.mockImplementation((authority: string | string[]) => authority === Authority.ADMIN);
    actingAs.open({ patientId: 'patient-1', name: 'Kojo Ampia-Addison', own: false });

    const banner = build();

    expect(banner.canSwitch()).toBe(false);
    expect(banner.canFind()).toBe(true);
  });

  it('never offers the finder to a patient or an angel', () => {
    // Keyed on the role, not on the choice count: a patient with one record must not be invited to
    // go looking through everybody else's.
    actingAs.setAvailable([{ patientId: 'me', name: 'Kojo', own: true }]);

    expect(build().canFind()).toBe(false);
  });
});
