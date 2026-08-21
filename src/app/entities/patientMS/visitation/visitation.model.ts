/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/visitation/visitation.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';

export interface IVisitation {
  id: string;
  patientId?: string | null;
  caseId?: string | null;
  professionalId?: string | null;
  visitedAt?: dayjs.Dayjs | null;
  purpose?: string | null;
  location?: string | null;
  notes?: string | null;
  createdDate?: dayjs.Dayjs | null;
  modifiedDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
  modifiedBy?: string | null;
}

export type NewVisitation = Omit<IVisitation, 'id'> & { id: null };
