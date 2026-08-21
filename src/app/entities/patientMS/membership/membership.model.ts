/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/membership/membership.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';

export interface IMembership {
  id: string;
  patientId?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  memberNumber?: string | null;
  plan?: string | null;
  startDate?: dayjs.Dayjs | null;
  renewalDate?: dayjs.Dayjs | null;
  createdDate?: dayjs.Dayjs | null;
  modifiedDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
  modifiedBy?: string | null;
}

export type NewMembership = Omit<IMembership, 'id'> & { id: null };
