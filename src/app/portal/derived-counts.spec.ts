import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';

import { PatientContextService } from './data/patient-context.service';
import { PortalDataService } from './data/portal-data.service';
import { Resource, failed, loaded, LOADING } from './data/resource';
import { AllergiesPage } from './allergies/allergies.page';
import { MedicationsPage } from './medications/medications.page';
import { OverviewPage } from './overview/overview.page';
import { PlansPage } from './plans/plans.page';

/**
 * §7.5's CLOSING RULE, which is the easiest in the whole plan to skip because the code compiles
 * either way and the screen looks fine in every screenshot:
 *
 *   "Anything computed() across streams must decide explicitly what a failure means for it. The
 *    overview's '3 of your 12 cases are active' must not render while cases$ is failed, because
 *    '0 active' would be a lie. Same for the emergencies badge: nothing on loading or failed,
 *    never 0."
 *
 * Every assertion below is the same shape: a stream fails, and the number derived from it must come
 * out `null` rather than `0`. They are gathered in one file because the rule is one rule, and a
 * reader who breaks it on a fourteenth screen should find all thirteen precedents together.
 */
describe('derived counts are null, never a confident zero', () => {
  function streams(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      cases$: new BehaviorSubject(loaded([])),
      archivedCases$: new BehaviorSubject(loaded([])),
      vitals$: new BehaviorSubject(loaded([])),
      medications$: new BehaviorSubject(loaded([])),
      reports$: new BehaviorSubject(loaded([])),
      schedules$: new BehaviorSubject(loaded([])),
      visitations$: new BehaviorSubject(loaded([])),
      emergencies$: new BehaviorSubject(loaded([])),
      activity$: new BehaviorSubject(loaded([])),
      carePlan$: new BehaviorSubject(loaded([])),
      allergies$: new BehaviorSubject(loaded([])),
      conditions$: new BehaviorSubject(loaded([])),
      memberships$: new BehaviorSubject(loaded([])),
      casesById$: of(loaded(new Map())),
      reload: jest.fn(),
      ...over,
    };
  }

  async function make<T>(page: new (...args: never[]) => T, over: Record<string, unknown> = {}): Promise<ComponentFixture<T>> {
    await TestBed.configureTestingModule({
      imports: [page as never, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PortalDataService, useValue: streams(over) },
        {
          provide: PatientContextService,
          useValue: {
            careTeamById$: of(new Map()),
            careTeamState$: of(loaded([])),
            profileState$: of(loaded(null)),
            patientIdState$: of(loaded('patient-kojo')),
            reload: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<T> = TestBed.createComponent(page as never);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  describe('the allergies banner — the most dangerous count in the app', () => {
    it('is null when the allergy fetch failed, so "0 allergies on record" is never shown', async () => {
      const fixture = await make(AllergiesPage, { allergies$: new BehaviorSubject(failed({ status: 0 })) });

      expect(fixture.componentInstance.allergyCount()).toBeNull();
    });

    it('is null while still loading', async () => {
      const fixture = await make(AllergiesPage, { allergies$: new BehaviorSubject(LOADING as Resource<readonly never[]>) });

      expect(fixture.componentInstance.allergyCount()).toBeNull();
    });

    it('is a real 0 when the patient genuinely has none', async () => {
      const fixture = await make(AllergiesPage, { allergies$: new BehaviorSubject(loaded([])) });

      expect(fixture.componentInstance.allergyCount()).toBe(0);
    });
  });

  describe('the overview tiles', () => {
    it('render a dash rather than a zero when their stream failed', async () => {
      const fixture = await make(OverviewPage, {
        cases$: new BehaviorSubject(failed({ status: 0 })),
        emergencies$: new BehaviorSubject(failed({ status: 0 })),
      });

      const openCases = fixture.componentInstance.tiles().find(t => t.labelKey.endsWith('openCases'));
      expect(openCases?.value).toBeNull();
      expect((fixture.nativeElement as HTMLElement).innerHTML).toContain('—');
    });

    /** §7.5 names this one directly: nothing on loading or failed, never 0. */
    it('hide the emergencies badge on failure, and on a genuine zero', async () => {
      const failedFixture = await make(OverviewPage, { emergencies$: new BehaviorSubject(failed({ status: 500 })) });
      expect(failedFixture.componentInstance.emergencyBadge()).toBeNull();

      TestBed.resetTestingModule();
      const emptyFixture = await make(OverviewPage, { emergencies$: new BehaviorSubject(loaded([])) });
      expect(emptyFixture.componentInstance.emergencyBadge()).toBeNull();
    });

    it('suppress the hero sentence when cases are unknown, since it counts them', async () => {
      const fixture = await make(OverviewPage, { cases$: new BehaviorSubject(failed({ status: 0 })) });

      expect(fixture.componentInstance.heroSummary()).toBeNull();
    });
  });

  describe('the care-plan progress bar', () => {
    it('is null on failure, so a dropped connection does not report 0% done', async () => {
      const fixture = await make(PlansPage, { carePlan$: new BehaviorSubject(failed({ status: 0 })) });

      expect(fixture.componentInstance.dietPercent()).toBeNull();
      expect(fixture.componentInstance.exercisePercent()).toBeNull();
    });

    it('is a real 0% when the plan genuinely has nothing ticked', async () => {
      const fixture = await make(PlansPage, { carePlan$: new BehaviorSubject(loaded([])) });

      expect(fixture.componentInstance.dietPercent()).toBe(0);
    });
  });

  describe('the medication counts', () => {
    /** Three zeroes would say "nothing withheld" — the one claim this row exists to make visible. */
    it('are null on failure rather than three confident zeroes', async () => {
      const fixture = await make(MedicationsPage, { medications$: new BehaviorSubject(failed({ status: 0 })) });

      expect(fixture.componentInstance.counts()).toBeNull();
    });
  });
});
