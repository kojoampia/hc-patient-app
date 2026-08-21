/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/patient-context.service.spec.ts @ 12e418c
 * Divergence: `profile$` -> `profileState$` and `careTeam$` -> `careTeamState$`, both now emitting
 *   Resource<T> with LOADING first (patient-mobile.md §7.5). Every assertion below is unchanged;
 *   they reach the value through the `loadedValue` helper instead of subscribing directly. The 404
 *   case is the one that matters most and is deliberately kept as-is: a missing profile is
 *   `loaded(null)`, NOT `failed` — "you have no profile" is a real state.
 * Re-sync: see PROVENANCE.md.
 */

import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { Observable, filter, map, of } from 'rxjs';
import dayjs from 'dayjs/esm';

import { AccountService } from 'app/core/auth/account.service';
import { Account } from 'app/core/auth/account.model';
import { ActingAsChoice, ActingAsService } from 'app/core/auth/acting-as.service';

import { CareTeamMember, PatientContextService } from './patient-context.service';
import { Resource, isLoaded } from './resource';

/**
 * Unwraps to the first loaded value, skipping the LOADING that §7.5 requires every stream to emit
 * first. Lets the lifted assertions stand unchanged.
 */
const loadedValue = <T>(source: Observable<Resource<T>>): Observable<T> =>
  source.pipe(filter(isLoaded), map(resource => resource.value));

const ACCOUNT = { email: 'kojo@jac.net' } as Account;

describe('PatientContextService', () => {
  describe('the profile fetched by email', () => {
    let service: PatientContextService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptorsFromDi()),
          provideHttpClientTesting(),
          { provide: AccountService, useValue: { identity: () => of(ACCOUNT) } },
        ],
      });
      service = TestBed.inject(PatientContextService);
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it('converts birthDate to a dayjs, as the entity service would', done => {
      // This endpoint is fetched directly, so nothing else applies the conversion. Left as the raw
      // string it emptied /record and the profile's About tab — every formatter threw on it.
      loadedValue(service.profileState$).subscribe(profile => {
        expect(dayjs.isDayjs(profile?.birthDate)).toBe(true);
        expect(profile?.birthDate?.format('DD MMM YYYY')).toBe('19 Apr 1976');
        done();
      });

      httpMock
        .expectOne(req => req.url.endsWith('/api/profiles/email/kojo%40jac.net'))
        .flush({ id: 'patient-kojo', patientId: 'patient-kojo', birthDate: '1976-04-19' });
    });

    it('leaves birthDate unset when the record has none', done => {
      loadedValue(service.profileState$).subscribe(profile => {
        expect(profile?.birthDate).toBeUndefined();
        done();
      });

      httpMock.expectOne(req => req.url.includes('/api/profiles/email/')).flush({ id: 'patient-kojo' });
    });

    it('treats a patient with no profile document as an empty state, not an error', done => {
      loadedValue(service.profileState$).subscribe(profile => {
        expect(profile).toBeNull();
        done();
      });

      httpMock.expectOne(req => req.url.includes('/api/profiles/email/')).flush('nope', { status: 404, statusText: 'Not Found' });
    });
  });

  /**
   * The regression these cover took the whole delegation feature down without failing anything.
   *
   * `profile$` resolved the signed-in account's email and nothing else, so a care angel who selected the patient
   * they act for was shown the loud banner naming that patient over their *own* record — every collection
   * downstream is filtered by the `patientId` this yields. The interceptor was sending `X-Acting-As` correctly and
   * the server was answering correctly; only the client's idea of whose record it was had never moved.
   */
  describe('the profile when acting for another patient', () => {
    let service: PatientContextService;
    let actingAs: ActingAsService;
    let httpMock: HttpTestingController;

    const own: ActingAsChoice = { patientId: 'patient-ophelia', name: 'Ophelia Gaisie', own: true };
    const delegated: ActingAsChoice = { patientId: 'patient-kojo', name: 'Kojo Ampia-Addison', own: false };

    beforeEach(() => {
      sessionStorage.clear();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptorsFromDi()),
          provideHttpClientTesting(),
          { provide: AccountService, useValue: { identity: () => of({ email: 'ophelia@localhost' } as Account) } },
        ],
      });
      service = TestBed.inject(PatientContextService);
      actingAs = TestBed.inject(ActingAsService);
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it('asks the server for the selected patient, not for the signed-in account', done => {
      actingAs.setAvailable([own, delegated]);
      actingAs.select('patient-kojo');

      loadedValue(service.profileState$).subscribe(profile => {
        // The id every other collection is then filtered by. If this stays the angel's own, the portal shows her
        // empty record under his name.
        expect(profile?.patientId).toBe('patient-kojo');
        done();
      });

      const request = httpMock.expectOne(req => req.url.endsWith('/api/profiles') && req.params.get('patientId') === 'patient-kojo');
      request.flush([{ id: 'kojo-1', patientId: 'patient-kojo', birthDate: '1976-04-19' }]);
    });

    it('goes back to the by-email bootstrap when the selection is the angel’s own record', done => {
      actingAs.setAvailable([own, delegated]);
      actingAs.select('patient-ophelia');

      loadedValue(service.profileState$).subscribe(profile => {
        expect(profile?.patientId).toBe('patient-ophelia');
        done();
      });

      // Deliberately the email endpoint: it is the only one that answers before a patientId is known, and the server
      // refuses it for any address but the caller's own.
      httpMock
        .expectOne(req => req.url.endsWith('/api/profiles/email/ophelia%40localhost'))
        .flush({ id: 'ophelia-1', patientId: 'patient-ophelia' });
    });

    it('treats a delegation that returns nothing as no record, rather than falling back to their own', done => {
      actingAs.setAvailable([own, delegated]);
      actingAs.select('patient-kojo');

      loadedValue(service.profileState$).subscribe(profile => {
        expect(profile).toBeNull();
        done();
      });

      httpMock.expectOne(req => req.url.endsWith('/api/profiles') && req.params.has('patientId')).flush([]);
    });
  });

  describe('how a clinician is named', () => {
    /** The care team as the service builds it, from what the endpoint returns. */
    function careTeamFrom(professionals: unknown[]): Promise<readonly CareTeamMember[]> {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptorsFromDi()),
          provideHttpClientTesting(),
          { provide: AccountService, useValue: { identity: () => of(ACCOUNT) } },
        ],
      });
      const service = TestBed.inject(PatientContextService);
      const httpMock = TestBed.inject(HttpTestingController);
      const members = new Promise<readonly CareTeamMember[]>(resolve => loadedValue(service.careTeamState$).subscribe(resolve));

      // The care team is reference data: it is fetched on its own, not behind the profile lookup.
      httpMock.expectOne(req => req.url.includes('/api/professionals')).flush(professionals);
      return members;
    }

    it('carries the honorific in the name, so every screen shows it without asking', async () => {
      const [member] = await careTeamFrom([
        { id: 'professional-grace', honorific: 'Dr.', firstName: 'Grace', lastName: 'Mensah', role: 'General Practitioner' },
      ]);
      expect(member.name).toBe('Dr. Grace Mensah');
    });

    it('names a clinician who has no honorific without a stray space', async () => {
      // Five of the record's six professionals have none, and inventing one from the role would put
      // "Dr." on a physiotherapist.
      const [member] = await careTeamFrom([{ id: 'professional-yaw', firstName: 'Yaw', lastName: 'Boateng', role: 'Physiotherapist' }]);
      expect(member.name).toBe('Yaw Boateng');
    });

    it('keeps the initials free of the honorific', async () => {
      const [member] = await careTeamFrom([
        { id: 'professional-grace', honorific: 'Dr.', firstName: 'Grace', lastName: 'Mensah', role: 'General Practitioner' },
      ]);
      expect(member.initials).toBe('GM');
    });
  });

  describe('authorNameOf', () => {
    const grace: CareTeamMember = {
      id: 'professional-grace',
      name: 'Dr. Grace Mensah',
      role: 'General Practitioner',
      initials: 'GM',
      location: 'Accra · Osu',
      imageUrl: null,
    };
    const careTeam = new Map([[grace.id, grace]]);

    it('credits the patient for what the patient wrote', () => {
      // The case timeline resolved authorId first and fell through to the "Care team" stand-in, so
      // the portal told the patient their own note was written by somebody else.
      expect(PatientContextService.authorNameOf(careTeam, { source: 'PATIENT', authorId: null })).toBe('You');
    });

    it('still credits the patient when an authorId happens to be set', () => {
      expect(PatientContextService.authorNameOf(careTeam, { source: 'PATIENT', authorId: 'professional-grace' })).toBe('You');
    });

    it('names the clinician for a professional entry', () => {
      expect(PatientContextService.authorNameOf(careTeam, { source: 'PROFESSIONAL', authorId: 'professional-grace' })).toBe(
        'Dr. Grace Mensah',
      );
    });

    it('names the platform for a system entry', () => {
      expect(PatientContextService.authorNameOf(careTeam, { source: 'SYSTEM', authorId: null })).toBe('Abofonsa BridgeCare');
    });

    it('falls back to the care team when the professional is not on it', () => {
      expect(PatientContextService.authorNameOf(careTeam, { source: 'PROFESSIONAL', authorId: 'someone-else' })).toBe('Care team');
      expect(PatientContextService.authorNameOf(careTeam, {})).toBe('Care team');
    });
  });
});
