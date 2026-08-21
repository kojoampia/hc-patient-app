/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/condition/condition.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';

export interface ICondition {
  id: string;
  name?: string | null;
  description?: string | null;
  patientId?: string | null;
  createdDate?: dayjs.Dayjs | null;
  modifiedDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
  modifiedBy?: string | null;
}

export type NewCondition = Omit<ICondition, 'id'> & { id: null };
