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
 * The plan chooser renders the tiers in `displayOrder`.
 *
 * `web` has sorted since 2026-09-07 and this app rendered response order until 2026-09-07, so the
 * two products would have presented the same three plans in different orders the moment Abofonsa
 * stopped returning them sorted — one product, two answers.
 *
 * EVERY ASSERTION HERE READS THE DOM, and that is the point rather than a stylistic preference.
 * `web`'s first attempt asserted `orderedPlans()` only, and a template still iterating the unsorted
 * signal passed all ten of its tests. The fixtures are also fed OUT OF ORDER on purpose: feeding
 * display order in and expecting it back out is a tautology that a no-op comparator would pass.
 */
describe('ProfilePage — the order of the plan cards', () => {
  let fixture: ComponentFixture<ProfilePage>;

  // ion-segment scrolls its active button into view the moment a value is set, and jsdom implements
  // scrollTo on neither Element nor HTMLElement. Opening the Membership tab is unavoidable here —
  // that is where the chooser lives — so the shim is the price of rendering this page at all.
  beforeAll(() => {
    Element.prototype.scrollTo = jest.fn();
  });

  /** What the content API answers with. Set by `build`, read lazily by the stubbed service. */
  let available: readonly MembershipPlan[] = [];

  const plan = (over: Partial<MembershipPlan>): MembershipPlan =>
    ({ id: 'plan-pear', code: 'PEAR', name: 'PEAR Plan', ...over }) as MembershipPlan;

  const pear = plan({ id: 'plan-pear', code: 'PEAR', name: 'PEAR Plan', priceAmount: '3,000', priceCurrency: 'GHS', displayOrder: 1 });
  const pawpaw = plan({
    id: 'plan-pawpaw',
    code: 'PAWPAW',
    name: 'PAWPAW Plan',
    priceAmount: '5,000',
    priceCurrency: 'GHS',
    displayOrder: 2,
  });
  const melon = plan({ id: 'plan-melon', code: 'MELON', name: 'MELON Plan', priceAmount: '8,000', priceCurrency: 'GHS', displayOrder: 3 });

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

  /** The plan cards as a reader meets them. The membership in force above them is a div, not an article. */
  const cards = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('.hc-grid article.hc-card'));

  const names = (): string[] => cards().map(card => (card.querySelector('b.hc-grow')?.textContent ?? '').replace(/\s+/g, ' ').trim());

  it('renders the tiers in displayOrder rather than in the order they arrived', async () => {
    // A ROTATION, not a shuffle: 3, 1, 2 in. A no-op comparator answers MELON first, a reversal
    // answers MELON last, and a template iterating `plans()` answers the input — all three differ
    // from the expectation below, which is what makes this assertion worth having.
    await build([melon, pear, pawpaw]);

    expect(cards()).toHaveLength(3);
    expect(names()).toEqual(['PEAR Plan', 'PAWPAW Plan', 'MELON Plan']);
  });

  it('renders a tier with no displayOrder last, so an addition appends rather than taking the top', async () => {
    // `null` as well as `undefined`, because the payload is another product's and `??` catches both.
    const unordered = plan({ id: 'plan-new', code: 'NEW', name: 'NEW Plan', displayOrder: undefined });
    const alsoUnordered = plan({ id: 'plan-extra', code: 'EXTRA', name: 'EXTRA Plan', displayOrder: null as unknown as undefined });
    await build([unordered, melon, alsoUnordered, pear]);

    expect(cards()).toHaveLength(4);
    // Sorting the order-less pair to 0 rather than to the far end would open with them.
    expect(names()).toEqual(['PEAR Plan', 'MELON Plan', 'NEW Plan', 'EXTRA Plan']);
  });

  it('keeps response order between tiers that share a displayOrder', async () => {
    // `Array#sort` is stable per ES2019 and the comparator returns 0 on a tie, so tiers sharing a
    // `displayOrder` keep the order they arrived in. Fed so that response order is NOT alphabetical:
    // a secondary sort key — the obvious thing to add to "make ties deterministic" — would answer
    // PEAR first and quietly overrule the other product's own ordering.
    const tie = plan({ id: 'plan-tie', code: 'TIE', name: 'TIE Plan', displayOrder: 1 });
    await build([tie, pear, melon]);

    expect(cards()).toHaveLength(3);
    expect(names()).toEqual(['TIE Plan', 'PEAR Plan', 'MELON Plan']);
  });
});
