/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/status-label.pipe.spec.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import { TestBed } from '@angular/core/testing';
import { MissingTranslationHandlerParams, TranslateService } from '@ngx-translate/core';

import { MissingTranslationHandlerImpl } from 'app/config/translation.config';

import { StatusLabelPipe } from './status-label.pipe';

/**
 * The vocabulary drift these cover: the portal rendered every status by sentence-casing the enum,
 * so an emergency read "High" where the patient was meant to read "Urgent".
 *
 * <p>The fake below answers a missing key through the app's real {@link MissingTranslationHandlerImpl}
 * rather than by returning the key. That difference is the whole reason this suite passed while the
 * profile page showed `translation-not-found[patientPortal.status.active]`: stock ngx-translate
 * returns the key, this app does not, and a fake that models the library instead of the application
 * tests a fallback nothing can reach.</p>
 */
describe('StatusLabelPipe', () => {
  const LABELS: Record<string, string> = {
    'patientPortal.status.HIGH': 'Urgent',
    'patientPortal.status.TREATMENT': 'In treatment',
    'patientPortal.status.OK': 'In range',
    // The collision, as the real bundle has it: a medication that is being taken.
    'patientPortal.status.ACTIVE': 'Taking now',
    'patientPortal.status.membership.ACTIVE': 'Active',
  };

  let pipe: StatusLabelPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StatusLabelPipe,
        {
          provide: TranslateService,
          // Not `key`: this app installs a MissingTranslationHandler, so a miss comes back as
          // `translation-not-found[<key>]`. Answering with the key would test a different app.
          useValue: {
            instant: (key: string): string =>
              key in LABELS ? LABELS[key] : new MissingTranslationHandlerImpl().handle({ key } as MissingTranslationHandlerParams),
          },
        },
      ],
    });
    pipe = TestBed.inject(StatusLabelPipe);
  });

  it('gives an emergency the word a person reads, not the grading', () => {
    expect(pipe.transform('HIGH')).toBe('Urgent');
  });

  it('keeps the demo’s wording for a case and a reading', () => {
    expect(pipe.transform('TREATMENT')).toBe('In treatment');
    expect(pipe.transform('OK')).toBe('In range');
  });

  it('falls back to sentence case for a status nobody has translated yet', () => {
    // A backend that adds ESCALATED tomorrow must not render "patientPortal.status.ESCALATED".
    expect(pipe.transform('ESCALATED')).toBe('Escalated');
    expect(pipe.transform('AWAITING_REVIEW')).toBe('Awaiting review');
  });

  it('never leaks the missing-translation sentinel to the screen', () => {
    // What the profile page actually showed: "translation-not-found[patientPortal.status.active]".
    // The handler answers a miss with that string rather than the key, so a fallback that only
    // compared against the key could not fire.
    expect(pipe.transform('ESCALATED')).not.toContain('translation-not-found');
  });

  it('reads a membership status in the subscription’s vocabulary, not the medication’s', () => {
    // The bug on the profile page. Membership.status is a free String in patient.jdl and the demo
    // seed writes "active"; the flat map's ACTIVE is a medication being taken, so resolving a plan
    // through it would render the pill "Taking now" — plausible, and wrong.
    expect(pipe.transform('active', 'membership')).toBe('Active');
    expect(pipe.transform('ACTIVE')).toBe('Taking now');
  });

  it('falls back through the flat map when the domain has no entry', () => {
    expect(pipe.transform('HIGH', 'membership')).toBe('Urgent');
    expect(pipe.transform('ESCALATED', 'membership')).toBe('Escalated');
  });

  it.each([null, undefined, ''])('renders an em dash for %p', value => {
    expect(pipe.transform(value)).toBe('—');
  });
});
