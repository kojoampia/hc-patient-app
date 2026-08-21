/**
 * REWRITTEN, not lifted — the one file in portal/data/ that §7.2 lists as rewritten rather than
 * copied. Its origin is hc-patient-dashboard's src/main/webapp/app/portal/data/portal-data.service.ts
 * @ 12e418c, and it is listed in PROVENANCE.md so nobody goes looking for a lift that is not there.
 *
 * What changed and why: patient-mobile.md §7.5. The web's `scoped()` ends
 * `catchError(() => of([]))`, so every one of these twelve streams reports a dropped connection as
 * an empty collection.
 */

import { Injectable, inject } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, startWith, switchMap } from 'rxjs';

import { IActivityLog } from 'app/entities/patientMS/activity-log/activity-log.model';
import { IAllergy } from 'app/entities/patientMS/allergy/allergy.model';
import { ICarePlanItem } from 'app/entities/patientMS/care-plan-item/care-plan-item.model';
import { IClinicalCase } from 'app/entities/patientMS/clinical-case/clinical-case.model';
import { ICondition } from 'app/entities/patientMS/condition/condition.model';
import { IEmergency } from 'app/entities/patientMS/emergency/emergency.model';
import { IMedication } from 'app/entities/patientMS/medication/medication.model';
import { IMembership } from 'app/entities/patientMS/membership/membership.model';
import { IReport } from 'app/entities/patientMS/report/report.model';
import { IStat } from 'app/entities/patientMS/stat/stat.model';
import { ITask } from 'app/entities/patientMS/task/task.model';
import { IVisitation } from 'app/entities/patientMS/visitation/visitation.model';

import { ActivityLogService } from 'app/entities/patientMS/activity-log/service/activity-log.service';
import { AllergyService } from 'app/entities/patientMS/allergy/service/allergy.service';
import { CarePlanItemService } from 'app/entities/patientMS/care-plan-item/service/care-plan-item.service';
import { ClinicalCaseService } from 'app/entities/patientMS/clinical-case/service/clinical-case.service';
import { ConditionService } from 'app/entities/patientMS/condition/service/condition.service';
import { EmergencyService } from 'app/entities/patientMS/emergency/service/emergency.service';
import { MedicationService } from 'app/entities/patientMS/medication/service/medication.service';
import { MembershipService } from 'app/entities/patientMS/membership/service/membership.service';
import { ReportService } from 'app/entities/patientMS/report/service/report.service';
import { StatService } from 'app/entities/patientMS/stat/service/stat.service';
import { TaskService } from 'app/entities/patientMS/task/service/task.service';
import { VisitationService } from 'app/entities/patientMS/visitation/service/visitation.service';

import { PatientContextService } from './patient-context.service';
import { LOADING, Resource, failed, loaded, mapResource } from './resource';

/** Anything the portal lists carries the patient it belongs to. */
interface PatientScoped {
  patientId?: string | null;
}

/** The shape of a generated JHipster entity service, narrowed to what this file uses. */
interface QueryableService<T> {
  query(req?: unknown): Observable<HttpResponse<T[]>>;
}

/**
 * Every collection the portal reads, already narrowed to the signed-in patient and carrying its own
 * loading / loaded / failed state.
 *
 * Screens depend on this rather than on the generated entity services directly, for two reasons:
 * the patient filter is applied in exactly one place, and each collection is fetched once and
 * shared across the screens that need it.
 */
@Injectable({ providedIn: 'root' })
export class PortalDataService {
  private readonly context = inject(PatientContextService);

  readonly cases$ = this.scoped<IClinicalCase>(inject(ClinicalCaseService));
  readonly vitals$ = this.scoped<IStat>(inject(StatService));
  readonly medications$ = this.scoped<IMedication>(inject(MedicationService));
  readonly reports$ = this.scoped<IReport>(inject(ReportService));
  readonly schedules$ = this.scoped<ITask>(inject(TaskService));
  readonly visitations$ = this.scoped<IVisitation>(inject(VisitationService));
  readonly emergencies$ = this.scoped<IEmergency>(inject(EmergencyService));
  readonly activity$ = this.scoped<IActivityLog>(inject(ActivityLogService));
  readonly carePlan$ = this.scoped<ICarePlanItem>(inject(CarePlanItemService));
  readonly allergies$ = this.scoped<IAllergy>(inject(AllergyService));
  readonly conditions$ = this.scoped<ICondition>(inject(ConditionService));
  readonly memberships$ = this.scoped<IMembership>(inject(MembershipService));

  /**
   * Cases indexed by id, so a medication or report can name the case it belongs to.
   *
   * Keeps the Resource wrapper rather than collapsing to an empty map: a screen showing "case:
   * unknown" because the case list failed is telling the reader something false about their record.
   */
  readonly casesById$: Observable<Resource<ReadonlyMap<string, IClinicalCase>>> = this.cases$.pipe(
    map(state => mapResource(state, cases => new Map(cases.map(item => [item.id, item])) as ReadonlyMap<string, IClinicalCase>)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /** Re-fetches everything. The context owns the trigger, so this also refreshes the care team. */
  reload(): void {
    this.context.reload();
  }

  /**
   * Fetches a collection for the current patient.
   *
   * Three things here are load-bearing and none of them is obvious.
   *
   * **1. The double filter, unchanged from the web.** `patientId` goes to the server as a query
   * parameter AND the same filter is applied again to the response. That is not redundant: a service
   * that does not yet honour the parameter returns everything, and the portal must not show one
   * patient another's records because a backend was behind. Defence in depth — keep both.
   *
   * **2. `loaded([])` when there is no patient id.** No record is not a failure. Somebody who has
   * signed in but has no profile yet should see an empty list, not a retry button for a request that
   * was never worth making.
   *
   * **3. `startWith(LOADING)` INSIDE the switchMap, AFTER catchError.** This placement earns its
   * keep twice, and moving it outside the switchMap silently breaks both:
   *
   *   - It guarantees the sequence is always `loading -> (loaded | failed)`, so `hpm-stream` never
   *     has to cope with a first emission that is already a value.
   *   - Because it is inside, **an acting-as switch resets all twelve streams to `loading`.** That
   *     fixes a live defect in the web: `shareReplay({ refCount: false })` keeps the previous
   *     patient's rows on screen, under the new patient's name, for the whole duration of the new
   *     request. The banner says one person and the list shows another's medications. Outside the
   *     switchMap, `startWith` fires once on subscribe and never again — and the defect is back.
   */
  private scoped<T extends PatientScoped>(service: QueryableService<T>): Observable<Resource<readonly T[]>> {
    return this.context.patientIdState$.pipe(
      switchMap(idState => {
        // Loading and failed pass straight through from the profile. A collection cannot be in a
        // better state than the record it belongs to — if we do not know whose record this is, we
        // certainly do not know what is in it.
        if (idState.state !== 'loaded') {
          return of(idState as Resource<readonly T[]>);
        }

        const patientId = idState.value;
        if (!patientId) {
          return of(loaded([] as readonly T[]));
        }

        return service.query({ patientId }).pipe(
          map(response => loaded((response.body ?? []).filter(item => item.patientId === patientId) as readonly T[])),
          catchError((error: unknown) => of(failed<readonly T[]>(error))),
          startWith(LOADING as Resource<readonly T[]>),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }
}
