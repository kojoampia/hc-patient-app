/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/care-plan-item/care-plan-item.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';
import { CarePlanType } from 'app/entities/enumerations/care-plan-type.model';

export interface ICarePlanItem {
  id: string;
  patientId?: string | null;
  planType?: keyof typeof CarePlanType | null;
  label?: string | null;
  detail?: string | null;
  cadence?: string | null;
  completed?: boolean | null;
  sortOrder?: number | null;
  createdDate?: dayjs.Dayjs | null;
  modifiedDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
  modifiedBy?: string | null;
}

export type NewCarePlanItem = Omit<ICarePlanItem, 'id'> & { id: null };
