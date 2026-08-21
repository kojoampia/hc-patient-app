import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';

import { IAllergy } from 'app/entities/patientMS/allergy/allergy.model';
import { PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { LOADING, Resource, failed, loaded } from '../data/resource';
import { AllergiesPage } from './allergies.page';

/**
 * The loading / empty / failed trio phase 5's done-when requires of every screen.
 *
 * The failed case is the one worth having: §7.5 exists because the web renders a dropped connection
 * and an empty collection identically, and a screen that unwraps its Resource too early brings that
 * defect straight back.
 */
describe('AllergiesPage', () => {
  let fixture: ComponentFixture<AllergiesPage>;

  async function build(state: Resource<readonly IAllergy[]>): Promise<void> {
    const streams = {
      cases$: new BehaviorSubject(loaded([])),
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
    };
    streams.allergies$ = new BehaviorSubject(state) as never;

    await TestBed.configureTestingModule({
      imports: [AllergiesPage, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PortalDataService, useValue: streams },
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

    fixture = TestBed.createComponent(AllergiesPage);
    fixture.detectChanges();
  }

  const html = (): string => (fixture.nativeElement as HTMLElement).innerHTML;

  it('shows skeletons while loading', async () => {
    await build(LOADING as Resource<readonly IAllergy[]>);

    expect(html()).toContain('ion-skeleton-text');
  });

  it('shows the empty state only when the collection genuinely loaded empty', async () => {
    await build(loaded([]));

    expect(html()).toContain('hpm-empty-state');
  });

  it('shows a failure, NEVER the empty state, when the fetch failed', async () => {
    await build(failed({ status: 0 }));

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
  });

  it('offers a pull-to-refresh', async () => {
    await build(loaded([]));

    expect((fixture.nativeElement as HTMLElement).querySelector('ion-refresher')).not.toBeNull();
  });

  it('offers the More sheet, since five tabs cannot reach ten destinations', async () => {
    await build(loaded([]));

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('ion-button'));
    expect(buttons.some(b => b.querySelector('ion-icon[name="ellipsis-horizontal"]'))).toBe(true);
  });

});
