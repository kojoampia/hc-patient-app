/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/login/login.service.spec.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AccountService } from 'app/core/auth/account.service';
import { ActingAsChoice, ActingAsService } from 'app/core/auth/acting-as.service';
import { AuthServerProvider } from 'app/core/auth/auth-jwt.service';

import { LoginService } from './login.service';

/**
 * One thing, and it is the one that was missing: authenticating in either direction must not leave behind a
 * selection about whose medical record is on screen.
 *
 * <p>`ActingAsService.clear()` existed from the day delegation was built, documented as "cleared on sign-out", and
 * had no callers at all. The consequence is not an untidy storage key: a care angel's selection survived into the
 * next person's session at the same browser, and because `setAvailable` accepts a remembered id that is still valid
 * for the new signer-in, it was applied silently — no picker, and the portal opened somebody else's record.</p>
 */
describe('LoginService and the acting-as selection', () => {
  let service: LoginService;
  let actingAs: ActingAsService;

  const own: ActingAsChoice = { patientId: 'patient-ophelia', name: 'Ophelia Gaisie', own: true };
  const delegated: ActingAsChoice = { patientId: 'patient-kojo', name: 'Kojo Ampia-Addison', own: false };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: { identity: () => of(null), authenticate: () => undefined } },
        { provide: AuthServerProvider, useValue: { login: () => of({}), logout: () => of(undefined) } },
      ],
    });
    service = TestBed.inject(LoginService);
    actingAs = TestBed.inject(ActingAsService);
  });

  function selectTheDelegatedRecord(): void {
    actingAs.setAvailable([own, delegated]);
    actingAs.select('patient-kojo');
    expect(actingAs.header()).toBe('patient-kojo');
  }

  it('forgets the selection on sign-out', () => {
    selectTheDelegatedRecord();

    service.logout();

    expect(actingAs.header()).toBeNull();
    // Checked at the storage too, because that is what the next session restores from — the in-memory signal being
    // null is not enough on its own.
    expect(sessionStorage.getItem('hc-acting-as')).toBeNull();
  });

  it('forgets the selection on sign-in, so a session that ended without a sign-out cannot leak', () => {
    selectTheDelegatedRecord();

    service.login({ username: 'someone-else', password: 'irrelevant', rememberMe: false });

    expect(sessionStorage.getItem('hc-acting-as')).toBeNull();
  });
});
