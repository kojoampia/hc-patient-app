/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/emergency/emergency.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';
import { EmergencySeverity } from 'app/entities/enumerations/emergency-severity.model';
import { EmergencyStatus } from 'app/entities/enumerations/emergency-status.model';

export interface IEmergency {
  id: string;
  patientId?: string | null;
  caseId?: string | null;
  raisedAt?: dayjs.Dayjs | null;
  resolvedAt?: dayjs.Dayjs | null;
  brief?: string | null;
  detail?: string | null;
  severity?: keyof typeof EmergencySeverity | null;
  status?: keyof typeof EmergencyStatus | null;
  outcome?: string | null;
  location?: string | null;
  respondentId?: string | null;
  createdDate?: dayjs.Dayjs | null;
  modifiedDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
  modifiedBy?: string | null;
}

export type NewEmergency = Omit<IEmergency, 'id'> & { id: null };
