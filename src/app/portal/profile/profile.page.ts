/**
 * Adapted from hc-patient-dashboard
 *   src/main/webapp/app/portal/profile/profile.component.ts @ 12e418c
 * Divergence: Resource<T> streams (§7.5); the five tabs become an ion-segment; and the acting-as
 *   guard in §4 is enforced here rather than assumed — see `canManageAngel`.
 * Re-sync: see PROVENANCE.md.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { IonButton, IonLabel, IonSegment, IonSegmentButton } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { switchMap } from 'rxjs';
import dayjs from 'dayjs/esm';

import { IMembership } from 'app/entities/patientMS/membership/membership.model';
import { IProfile } from 'app/entities/patientMS/profile/profile.model';
import { MembershipService } from 'app/entities/patientMS/membership/service/membership.service';
import { ActingAsService } from 'app/core/auth/acting-as.service';
import { AvatarComponent } from 'app/shared/ui/avatar/avatar.component';
import { PortalNavService } from 'app/shell/portal-nav.service';
import { StreamComponent } from 'app/shared/ui/stream/stream.component';
import TranslateDirective from 'app/shared/language/translate.directive';

import { CareTeamMember, PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { PortalPageComponent } from '../portal-page.component';
import { StatusLabelPipe } from '../data/status-label.pipe';
import { CareDelegation, CareDelegationService } from '../data/care-delegation.service';
import { MembershipPlan, MembershipPlanService } from '../data/membership-plan.service';
import { LOADING, Resource, rowsOf } from '../data/resource';
import { formatAddress, formatDay } from '../data/portal-format';

type ProfileTab = 'about' | 'contact' | 'careAngel' | 'membership' | 'careTeam';

/** The tabs, in order. Kept as data so the template does not repeat the list twice. */
const TABS: readonly { readonly id: ProfileTab; readonly labelKey: string }[] = [
  { id: 'about', labelKey: 'patientPortal.profile.tab.about' },
  { id: 'contact', labelKey: 'patientPortal.profile.tab.contact' },
  { id: 'careAngel', labelKey: 'patientPortal.profile.tab.careAngel' },
  { id: 'membership', labelKey: 'patientPortal.profile.tab.membership' },
  { id: 'careTeam', labelKey: 'patientPortal.profile.tab.careTeam' },
];

/** Who the patient is, how to reach them, what plan they are on, and who looks after them. */
@Component({
  selector: 'hpm-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    TranslateDirective,
    PortalPageComponent,
    StreamComponent,
    AvatarComponent,
    StatusLabelPipe,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonButton,
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  private readonly context = inject(PatientContextService);
  private readonly careDelegationService = inject(CareDelegationService);
  private readonly membershipPlanService = inject(MembershipPlanService);
  private readonly membershipService = inject(MembershipService);
  private readonly data = inject(PortalDataService);
  private readonly actingAs = inject(ActingAsService);
  private readonly portalNav = inject(PortalNavService);

  /** Bumped after a revocation so the list re-reads rather than showing what was true a moment ago. */
  private readonly delegationRefresh = signal(0);

  readonly formatDay = formatDay;
  readonly formatAddress = formatAddress;
  readonly tabs = TABS;

  readonly activeTab = signal<ProfileTab>('about');
  readonly busy = signal(false);
  readonly delegationError = signal<string | null>(null);

  readonly profileState = toSignal(this.context.profileState$, { initialValue: LOADING as Resource<IProfile | null> });
  readonly careTeamState = toSignal(this.context.careTeamState$, {
    initialValue: LOADING as Resource<readonly CareTeamMember[]>,
  });
  readonly membershipsState = toSignal(this.data.memberships$, { initialValue: LOADING as Resource<readonly IMembership[]> });

  /**
   * Every delegation over this patient's record, in any state.
   *
   * Deliberately not just the active one. A patient needs to see that a nomination is still waiting
   * — the difference between "nobody accepted yet" and "nothing was ever sent" — and a standby they
   * consented to, which grants nothing today but would matter on the day it is activated.
   */
  readonly delegations = toSignal(
    toObservable(this.delegationRefresh).pipe(switchMap(() => this.careDelegationService.forCurrentPatient())),
    { initialValue: [] as readonly CareDelegation[] },
  );

  readonly profile = computed(() => {
    const state = this.profileState();
    return state.state === 'loaded' ? state.value : null;
  });

  readonly careTeam = computed(() => rowsOf(this.careTeamState()));

  /**
   * §4: **no nominating a further angel on the patient's behalf, and no editing `careAngelEmail` or
   * `careAngelLogin` while acting as somebody.** Otherwise an angel could hand their access to a
   * third party or lock the patient's own nominee out.
   *
   * The list is still SHOWN while acting — an angel should be able to see who else can act — but the
   * controls that change it are not rendered.
   */
  readonly canManageAngel = computed(() => !this.actingAs.actingForSomeoneElse());

  readonly fullName = computed(() => {
    const profile = this.profile();
    if (!profile) {
      return '';
    }
    return [profile.firstName, profile.middleNames, profile.lastName].filter(Boolean).join(' ').trim();
  });

  readonly initials = computed(() => {
    const profile = this.profile();
    if (!profile) {
      return '';
    }
    return `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  });

  /** The membership currently in force, preferring an explicitly active one. */
  readonly membership = computed(() => {
    const all = rowsOf(this.membershipsState());
    return all.find(item => item.status?.toUpperCase() === 'ACTIVE') ?? all.at(0) ?? null;
  });

  /** The tiers on offer, empty when Abofonsa cannot be reached. */
  readonly plans = toSignal(this.membershipPlanService.plans(), { initialValue: [] as readonly MembershipPlan[] });

  /**
   * The tiers in the order the content API asks for them to be shown.
   *
   * `displayOrder` is the other product's decision about how a price ladder reads, and this app took
   * whatever order the response happened to be in until 2026-09-07 — `web` had sorted since item 12,
   * so the two clients would have presented the same three plans differently the moment Abofonsa
   * stopped returning them in order. One product, two answers, which is the milder cousin of the
   * failure the "never restate a plan price" comment in the template exists to prevent.
   *
   * Three properties of this are deliberate. `??` catches `null` as well as `undefined`; a tier with
   * no order sorts **last**, so an unordered addition on their side appends rather than silently
   * taking the top of the ladder; and `Array#sort` is stable per ES2019 with the comparator
   * returning 0 on a tie, so tiers sharing a `displayOrder` keep the order they arrived in. The copy
   * is what keeps `sort` off the signal's own array.
   */
  readonly orderedPlans = computed(() =>
    [...this.plans()].sort(
      (left, right) => (left.displayOrder ?? Number.MAX_SAFE_INTEGER) - (right.displayOrder ?? Number.MAX_SAFE_INTEGER),
    ),
  );

  readonly choosingPlan = signal(false);
  readonly planError = signal<string | null>(null);

  /**
   * Ends a delegation.
   *
   * The angel is emailed, and the record of who could act and between which dates is kept —
   * revoking sets a status rather than erasing anything. Access stops on their very next request,
   * because the backend re-reads the delegation rather than trusting a token.
   */
  revoke(delegation: CareDelegation): void {
    this.busy.set(true);
    this.delegationError.set(null);
    this.careDelegationService.revoke(delegation.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.delegationRefresh.update(value => value + 1);
        // The profile carries a cached copy of the active angel's name; without this the screen
        // keeps showing somebody who can no longer act.
        this.context.reload();
      },
      error: () => {
        this.busy.set(false);
        this.delegationError.set('patientPortal.profile.careAngel.error.revokeFailed');
      },
    });
  }

  /**
   * Records the patient's choice as a Membership.
   *
   * This records a choice; it does not bill for one. A plan chosen here is PENDING until the
   * subscription domain exists — saying ACTIVE would claim something nothing in the system has done.
   */
  choosePlan(plan: MembershipPlan): void {
    const patientId = this.profile()?.patientId ?? this.profile()?.id;
    if (!patientId) {
      return;
    }
    this.choosingPlan.set(true);
    this.planError.set(null);
    this.membershipService
      .create({
        id: null,
        patientId,
        plan: plan.code,
        name: plan.name,
        description: plan.forWho ?? null,
        status: 'PENDING',
        startDate: dayjs(),
      })
      .subscribe({
        next: () => {
          this.choosingPlan.set(false);
          this.data.reload();
        },
        error: () => {
          this.choosingPlan.set(false);
          this.planError.set('patientPortal.profile.plan.error.failed');
        },
      });
  }

  /**
   * Opens the account-deletion request screen.
   *
   * Through `PortalNavService` rather than the `routerLink="/tabs/delete-account"` this used to
   * carry: `TAB_OWNER` puts the screen on the profile stack, so the address is
   * `/tabs/profile/delete-account`, and §8.1's rule that no template writes a `/tabs/...` URL exists
   * precisely so this link does not have to be found and edited when that changes again.
   */
  openDeletion(): void {
    void this.portalNav.go('delete-account', 'profile');
  }
}
