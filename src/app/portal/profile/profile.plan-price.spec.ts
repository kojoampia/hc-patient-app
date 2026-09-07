import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MembershipPlan, MembershipPlanService } from '../data/membership-plan.service';
import { PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { CareDelegationService } from '../data/care-delegation.service';
import { loaded } from '../data/resource';
import { ProfilePage } from './profile.page';

/**
 * The price on a plan card carries its currency.
 *
 * Both clients showed "3,000", "5,000" and "8,000" with no unit anywhere on the screen until
 * 2026-09-07. The §4 rule this sits next to forbids *restating* a price — no CurrencyPipe, no
 * arithmetic — and `priceCurrency` is a field the same response supplies, so rendering it is not
 * restating anything. Pinned because the two are easy to confuse, and the next reader of that
 * capitalised comment may well delete this again.
 */
describe('ProfilePage — the plan price', () => {
  let fixture: ComponentFixture<ProfilePage>;

  // ion-segment scrolls its active button into view the moment a value is set, and jsdom implements
  // scrollTo on neither Element nor HTMLElement. Opening the Membership tab is unavoidable here —
  // that is where the chooser lives — so the shim is the price of rendering this page at all.
  beforeAll(() => {
    Element.prototype.scrollTo = jest.fn();
  });

  let available: readonly MembershipPlan[] = [];

  const plan = (over: Partial<MembershipPlan>): MembershipPlan =>
    ({ id: 'plan-pear', code: 'PEAR', name: 'PEAR Plan', ...over }) as MembershipPlan;

  async function build(plans: readonly MembershipPlan[]): Promise<void> {
    available = plans;
    await TestBed.configureTestingModule({
      imports: [ProfilePage, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PortalDataService, useValue: { memberships$: of(loaded([])), reload: jest.fn() } },
        {
          provide: PatientContextService,
          useValue: {
            profileState$: of(loaded({ id: 'p1', patientId: 'patient-1', firstName: 'Kojo', lastName: 'Ampia-Addison' })),
            careTeamState$: of(loaded([])),
            reload: jest.fn(),
          },
        },
        { provide: CareDelegationService, useValue: { forCurrentPatient: () => of([]), revoke: jest.fn() } },
        { provide: MembershipPlanService, useValue: { plans: () => of(available) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePage);
    fixture.componentInstance.activeTab.set('membership');
    fixture.detectChanges();
  }

  const price = (): string => {
    const pill: HTMLElement | null = fixture.nativeElement.querySelector('.hc-pill--gold');
    return (pill?.textContent ?? '').replace(/\s+/g, ' ').trim();
  };

  it('renders the currency beside the amount, neither of them re-formatted', async () => {
    await build([plan({ priceAmount: '3,000', priceCurrency: 'GHS' })]);

    expect(price()).toBe('GHS 3,000');
  });

  it('renders the amount alone when the tier carries no currency', async () => {
    await build([plan({ priceAmount: '3,000', priceCurrency: null })]);

    expect(price()).toBe('3,000');
  });
});
