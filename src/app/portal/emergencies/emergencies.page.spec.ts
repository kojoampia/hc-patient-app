import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';
import dayjs from 'dayjs/esm';

import { IEmergency } from 'app/entities/patientMS/emergency/emergency.model';
import { PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { LOADING, Resource, failed, loaded } from '../data/resource';
import { EmergenciesPage } from './emergencies.page';

/**
 * The loading / empty / failed trio phase 5's done-when requires of every screen.
 *
 * On this screen in particular the empty state is the dangerous one: "No emergencies on record" is
 * a clinical claim, and it must never be what a dropped connection produces. That is the whole
 * point of §7.5 and it is asserted here rather than assumed from hpm-stream's own tests.
 */
describe('EmergenciesPage', () => {
  let fixture: ComponentFixture<EmergenciesPage>;
  let emergencies$: BehaviorSubject<Resource<readonly IEmergency[]>>;

  const EMERGENCY = (over: Partial<IEmergency> = {}): IEmergency =>
    ({ id: 'e1', brief: 'Chest pain', severity: 'HIGH', status: 'RESOLVED', ...over }) as IEmergency;

  async function build(state: Resource<readonly IEmergency[]>): Promise<void> {
    emergencies$ = new BehaviorSubject(state);

    await TestBed.configureTestingModule({
      imports: [EmergenciesPage, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: PortalDataService,
          useValue: { emergencies$, casesById$: of(LOADING), reload: jest.fn() },
        },
        { provide: PatientContextService, useValue: { careTeamById$: of(new Map()) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmergenciesPage);
    fixture.detectChanges();
  }

  const html = (): string => (fixture.nativeElement as HTMLElement).innerHTML;

  it('shows skeletons while loading, and no empty state', async () => {
    await build(LOADING as Resource<readonly IEmergency[]>);

    expect(html()).toContain('ion-skeleton-text');
    expect(html()).not.toContain('hpm-empty-state');
  });

  it('shows the empty state only when the collection genuinely loaded empty', async () => {
    await build(loaded([]));

    expect(html()).toContain('hpm-empty-state');
    expect(html()).not.toContain('ion-skeleton-text');
  });

  /**
   * THE ONE THAT MATTERS. A dropped connection must not render as "No emergencies on record".
   */
  it('shows a failure with a retry, NEVER the empty state, when the fetch failed', async () => {
    await build(failed({ status: 0 }));

    expect(html()).not.toContain('hpm-empty-state');
    expect(html()).toContain('ion-button');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
  });

  it('renders rows once loaded', async () => {
    await build(loaded([EMERGENCY(), EMERGENCY({ id: 'e2', brief: 'Fall at home' })]));

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('article.hc-card').length).toBe(2);
  });

  it('offers the care line above the list, so it is reachable without scrolling history', async () => {
    await build(loaded([]));

    const call = (fixture.nativeElement as HTMLElement).querySelector('a[href^="tel:"]');
    expect(call).not.toBeNull();
  });

  it('sorts newest first', async () => {
    await build(
      loaded([
        // dayjs, not an ISO string: the entity services convert their date fields, and byDateDesc
        // subtracts valueOf() — on two strings that is NaN, so it silently does not sort at all.
        EMERGENCY({ id: 'old', brief: 'Older', raisedAt: dayjs('2026-01-01T10:00:00Z') }),
        EMERGENCY({ id: 'new', brief: 'Newer', raisedAt: dayjs('2026-08-01T10:00:00Z') }),
      ]),
    );

    const briefs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('article.hc-card b')).map(el =>
      el.textContent.trim(),
    );
    expect(briefs[0]).toBe('Newer');
  });
});
