import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AccountService } from 'app/core/auth/account.service';
import { ActingAsService } from 'app/core/auth/acting-as.service';
import { CareDelegation, CareDelegationService, MineResponse } from 'app/portal/data/care-delegation.service';
import { OnboardingStatusService } from 'app/onboarding/onboarding-status.service';
import { SessionBootstrapService } from './session-bootstrap.service';

/**
 * §8.3's acceptance table, as a spec.
 *
 * The plan says these five accounts are verified by hand on a device in phase 3 and again in phase
 * 6, and they should be — a modal that a hardware back button dismisses is not something jsdom can
 * tell you about. But the ROUTING decision underneath each row is pure logic, it is the part that
 * has already been got wrong once in this codebase, and it should not need a handset to catch.
 */
describe('SessionBootstrapService — the §3.2 fork', () => {
  let service: SessionBootstrapService;
  let actingAs: ActingAsService;
  let mine: jest.Mock;
  let status: jest.Mock;

  const SELF = { patientId: 'patient-ophelia', firstName: 'Ophelia', lastName: 'Gaisie' };

  const delegation = (over: Partial<{ patientId: string; status: string; patientName: string }> = {}): CareDelegation => ({
    id: `d-${over.patientId ?? 'kojo'}`,
    patientId: over.patientId ?? 'patient-kojo',
    angelEmail: 'ophelia@localhost',
    patientName: over.patientName ?? 'Kojo Ampia-Addison',
    status: (over.status ?? 'ACTIVE') as never,
  });

  function givenMine(response: Partial<MineResponse>): void {
    mine.mockReturnValue(of({ email: 'ophelia@localhost', self: {}, delegations: [], ...response } as MineResponse));
  }

  beforeEach(() => {
    mine = jest.fn();
    status = jest.fn().mockReturnValue(of({ status: null, step: null, profileId: 'p', onboarded: true }));

    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: { hasAnyAuthority: () => false } },
        { provide: CareDelegationService, useValue: { mine } },
        { provide: OnboardingStatusService, useValue: { status } },
      ],
    });

    service = TestBed.inject(SessionBootstrapService);
    actingAs = TestBed.inject(ActingAsService);
  });

  /** Row 1: self and no delegations — nothing to choose. */
  it('sends a patient with only their own record straight into the portal', () => {
    givenMine({ self: SELF });

    service.restart();

    expect(service.outcome()).toEqual({ kind: 'portal' });
    expect(actingAs.current()?.own).toBe(true);
    expect(actingAs.mustChoose()).toBe(false);
  });

  /** Row 2: one delegation, no self — one option is not a decision. */
  it('auto-selects for an angel with a single delegation and no record of their own', () => {
    givenMine({ delegations: [delegation()] });

    service.restart();

    expect(service.outcome()).toEqual({ kind: 'portal' });
    expect(actingAs.current()?.patientId).toBe('patient-kojo');
    expect(actingAs.current()?.own).toBe(false);
    // The banner must name the patient, so the label is the PATIENT's name, never the angel's.
    expect(actingAs.current()?.name).toBe('Kojo Ampia-Addison');
  });

  /** Row 3: self AND a delegation — ask, do not choose on their behalf. */
  it('asks when the person has both their own record and a delegation', () => {
    givenMine({ self: SELF, delegations: [delegation()] });

    service.restart();

    expect(service.outcome()).toEqual({ kind: 'must-choose' });
    expect(actingAs.current()).toBeNull();
    expect(actingAs.mustChoose()).toBe(true);
  });

  /**
   * Row 4 — THE TRAP. A PENDING nomination grants nothing, so it does not read as "acting for
   * somebody". Sending them to onboarding asks them to create a patient record purely to answer
   * somebody else's nomination, and the inverse guard then keeps them there.
   */
  it('sends a PENDING nominee with no record to invitations, NOT to onboarding', () => {
    givenMine({ delegations: [delegation({ status: 'PENDING' })] });

    service.restart();

    expect(service.outcome()).toEqual({ kind: 'invitations-required' });
  });

  it('treats every non-ACTIVE nomination the same way', () => {
    for (const state of ['STANDBY', 'AWAITING_COUNTERSIGNATURE', 'DECLINED', 'REVOKED']) {
      givenMine({ delegations: [delegation({ status: state })] });

      service.restart();

      expect(service.outcome()).toEqual({ kind: 'invitations-required' });
    }
  });

  /** Row 5: neither, and no nomination — a fresh registration. */
  it('sends a fresh registration with no record and no nomination to onboarding', () => {
    givenMine({});

    service.restart();

    expect(service.outcome()).toEqual({ kind: 'onboarding-required' });
  });

  describe('onboarding status', () => {
    it('sends a half-onboarded patient to the onboarding dead end', () => {
      givenMine({ self: SELF });
      status.mockReturnValue(of({ status: 'IN_PROGRESS', step: 2, profileId: 'p', onboarded: false }));

      service.restart();

      expect(service.outcome()).toEqual({ kind: 'onboarding-required' });
    });

    /**
     * §2.3. A null `onboardingStatus` means COMPLETE, not NOT_STARTED — every patient who existed
     * before the feature has one. Re-deriving it would drag the entire existing patient base to a
     * dead end they cannot leave, because this app has no wizard to finish.
     */
    it('honours onboarded:true even when status is null', () => {
      givenMine({ self: SELF });
      status.mockReturnValue(of({ status: null, step: null, profileId: 'p', onboarded: true }));

      service.restart();

      expect(service.outcome()).toEqual({ kind: 'portal' });
    });

    it('does not ask about onboarding when acting for somebody else', () => {
      givenMine({ delegations: [delegation()] });

      service.restart();

      // An angel is not the patient. Asking about THEIR onboarding would strand them on a dead end
      // for a record they are not looking at.
      expect(status).not.toHaveBeenCalled();
    });

    it('lets a patient in when the status call itself fails', () => {
      givenMine({ self: SELF });
      status.mockReturnValue(throwError(() => ({ status: 503 })));

      service.restart();

      // A network blip must not throw a fully onboarded patient at a dead end.
      expect(service.outcome()).toEqual({ kind: 'portal' });
    });
  });

  describe('when /care-delegations/mine fails', () => {
    /**
     * The documented divergence from the web (§8.3). The web falls back to setAvailable([]), which
     * on mobile would show an angel-only user an empty portal under their own name.
     */
    it('reports failure rather than falling back to an empty portal', () => {
      mine.mockReturnValue(throwError(() => ({ status: 0 })));

      service.restart();

      expect(service.outcome()).toEqual({ kind: 'failed', status: 0 });
      expect(actingAs.available()).toEqual([]);
      expect(actingAs.current()).toBeNull();
    });
  });

  describe('re-running', () => {
    it('clears a previous selection before deciding again', () => {
      givenMine({ self: SELF, delegations: [delegation()] });
      service.restart();
      actingAs.select('patient-kojo');
      expect(actingAs.current()?.patientId).toBe('patient-kojo');

      // A different account signs in — nothing of the previous session may survive.
      givenMine({ self: { patientId: 'patient-ama', firstName: 'Ama', lastName: 'Serwaa' } });
      service.restart();

      expect(actingAs.current()?.patientId).toBe('patient-ama');
      expect(actingAs.available().some(c => c.patientId === 'patient-kojo')).toBe(false);
    });

    /**
     * §6 decision 4's consequence: an auto-selected single delegation produces an UNCHANGED banner
     * string on every cold start, so `role="status"` will not re-announce it. The banner needs a
     * signal that a run happened, independent of whether the value changed.
     */
    it('bumps a run counter even when the resulting selection is identical', () => {
      givenMine({ delegations: [delegation()] });

      service.restart();
      const first = service.runCount();
      service.restart();

      expect(service.runCount()).toBe(first + 1);
      expect(actingAs.current()?.patientId).toBe('patient-kojo');
    });
  });
});
