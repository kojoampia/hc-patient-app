import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';

import { IActivityLog } from 'app/entities/patientMS/activity-log/activity-log.model';
import { PatientContextService } from '../data/patient-context.service';
import { PortalDataService } from '../data/portal-data.service';
import { LOADING, Resource, failed, loaded } from '../data/resource';
import { ActivityPage } from './activity.page';

/**
 * The loading / empty / failed trio phase 5's done-when requires of every screen.
 *
 * The failed case is the one worth having: §7.5 exists because the web renders a dropped connection
 * and an empty collection identically, and a screen that unwraps its Resource too early brings that
 * defect straight back.
 */
describe('ActivityPage', () => {
  let fixture: ComponentFixture<ActivityPage>;

  async function build(state: Resource<readonly IActivityLog[]>): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ActivityPage, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: PortalDataService,
          useValue: { activity$: new BehaviorSubject(state), casesById$: of(LOADING), reload: jest.fn() },
        },
        { provide: PatientContextService, useValue: { careTeamById$: of(new Map()) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivityPage);
    fixture.detectChanges();
  }

  const html = (): string => (fixture.nativeElement as HTMLElement).innerHTML;

  it('shows skeletons while loading, and no empty state', async () => {
    await build(LOADING as Resource<readonly IActivityLog[]>);

    expect(html()).toContain('ion-skeleton-text');
    expect(html()).not.toContain('hpm-empty-state');
  });

  it('shows the empty state only when the collection genuinely loaded empty', async () => {
    await build(loaded([]));

    expect(html()).toContain('hpm-empty-state');
    expect(html()).not.toContain('ion-skeleton-text');
  });

  it('shows a failure, NEVER the empty state, when the fetch failed', async () => {
    await build(failed({ status: 0 }));

    expect(html()).not.toContain('hpm-empty-state');
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
