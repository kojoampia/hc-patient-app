/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/membership/membership.model.ts @ ce4bfe7
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';
import { MembershipStatus } from 'app/entities/enumerations/membership-status.model';

export interface IMembership {
  id: string;
  patientId?: string | null;
  name?: string | null;
  description?: string | null;
  status?: keyof typeof MembershipStatus | null;
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
