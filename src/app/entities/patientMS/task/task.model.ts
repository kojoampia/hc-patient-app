/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/task/task.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';
import { ScheduleStatus } from 'app/entities/enumerations/schedule-status.model';

export interface ITask {
  id: string;
  name?: string | null;
  description?: string | null;
  schedule?: dayjs.Dayjs | null;
  scheduledAt?: dayjs.Dayjs | null;
  duration?: number | null;
  status?: keyof typeof ScheduleStatus | null;
  location?: string | null;
  caseId?: string | null;
  attendantId?: string | null;
  teamId?: string | null;
  patientId?: string | null;
  attendant?: string | null;
  createdDate?: dayjs.Dayjs | null;
  modifiedDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
  modifiedBy?: string | null;
}

export type NewTask = Omit<ITask, 'id'> & { id: null };
