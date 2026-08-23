import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpHeaders, HttpResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { AccountService } from 'app/core/auth/account.service';
import { ActingAsService } from 'app/core/auth/acting-as.service';
import { IProfile } from 'app/entities/patientMS/profile/profile.model';
import { ProfileService } from 'app/entities/patientMS/profile/service/profile.service';
import { CareDelegationService } from 'app/portal/data/care-delegation.service';
import { OnboardingStatusService } from 'app/onboarding/onboarding-status.service';
import { SessionBootstrapService } from 'app/fork/session-bootstrap.service';

import { PatientFinderPage } from './patient-finder.page';

const kojo = { id: 'p1', patientId: 'patient-1', firstName: 'Kojo', lastName: 'Ampia-Addison', email: 'kojo@jac.net' } as IProfile;

const page = (profiles: IProfile[], total = profiles.length): HttpResponse<IProfile[]> =>
  new HttpResponse({ body: profiles, headers: new HttpHeaders({ 'X-Total-Count': String(total) }) });

/**
 * Where an administrator goes, and what they get when they arrive.
 *
 * The fork half matters more than the screen half: before this, an administrator resolved to
 * `onboarding-required` and was stranded on a dead end offering "Set up on the web" — signed in
 * successfully, and unable to use the app.
 */
describe('an administrator signing in', () => {
  let hasAnyAuthority: jest.Mock;
  let mine: jest.Mock;
  let bootstrap: SessionBootstrapService;
  let actingAs: ActingAsService;

  beforeEach(() => {
    hasAnyAuthority = jest.fn().mockReturnValue(true);
    mine = jest.fn().mockReturnValue(of({ email: 'admin@localhost', self: {}, delegations: [] }));
    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: { hasAnyAuthority } },
        { provide: CareDelegationService, useValue: { mine } },
        { provide: OnboardingStatusService, useValue: { status: jest.fn() } },
      ],
    });
    bootstrap = TestBed.inject(SessionBootstrapService);
    actingAs = TestBed.inject(ActingAsService);
  });

  it('is sent to the finder rather than to a dead end', () => {
    bootstrap.restart();

    expect(bootstrap.outcome().kind).toBe('finder');
  });

  it('never asks about delegations, because they hold none', () => {
    // Not an optimisation. A failed /care-delegations/mine would send an administrator to a retry
    // screen for a question that was never theirs.
    bootstrap.restart();

    expect(mine).not.toHaveBeenCalled();
  });

  it('goes to the portal once a record is open, not back to the finder', () => {
    // Without this, every re-entry to the shell throws the choice away and asks again.
    actingAs.open({ patientId: 'patient-1', name: 'Kojo Ampia-Addison', own: false });

    bootstrap.restart();

    expect(bootstrap.outcome().kind).toBe('portal');
    expect(actingAs.header()).toBe('patient-1');
  });

  it('leaves a patient fork alone', () => {
    hasAnyAuthority.mockReturnValue(false);

    bootstrap.restart();

    // Falls through to the delegation fetch exactly as before.
    expect(mine).toHaveBeenCalled();
  });
});

describe('PatientFinderPage', () => {
  let query: jest.Mock;
  let actingAs: ActingAsService;
  let component: PatientFinderPage;

  let fixture: ComponentFixture<PatientFinderPage>;

  const build = (): void => {
    fixture = TestBed.createComponent(PatientFinderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    query = jest.fn().mockReturnValue(of(page([])));
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), PatientFinderPage],
      providers: [
        // LoginService -> AccountService needs one, though the sign-out path is not exercised here.
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ProfileService, useValue: { query } },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: SessionBootstrapService, useValue: { restart: jest.fn() } },
      ],
    });
    actingAs = TestBed.inject(ActingAsService);
  });

  it('searches on the server rather than filtering here', fakeAsync(() => {
    query.mockReturnValue(of(page([kojo], 1)));
    build();
    tick(300);

    component.search.set('ampia');
    fixture.detectChanges();
    tick(300);

    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ampia' }));
  }));

  it('reports a failed fetch rather than an empty list', fakeAsync(() => {
    query.mockReturnValue(throwError(() => new Error('offline')));
    build();
    tick(300);

    expect(component.state()).toBe('failed');
  }));

  it('opens the record under the patientId the collections are keyed by', fakeAsync(() => {
    query.mockReturnValue(of(page([kojo], 1)));
    build();
    tick(300);

    component.open(kojo);

    expect(actingAs.header()).toBe('patient-1');
    expect(actingAs.actingForSomeoneElse()).toBe(true);
  }));

  it('falls back to the profile id when patientId was never set', fakeAsync(() => {
    const legacy = { id: 'legacy-9', patientId: null, firstName: 'Yaw', lastName: 'Boateng' } as IProfile;
    query.mockReturnValue(of(page([legacy], 1)));
    build();
    tick(300);

    component.open(legacy);

    expect(actingAs.header()).toBe('legacy-9');
  }));
});
