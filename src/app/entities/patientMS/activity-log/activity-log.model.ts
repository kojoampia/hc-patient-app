/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/activity-log/activity-log.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';
import { ActivityKind } from 'app/entities/enumerations/activity-kind.model';
import { ActivitySource } from 'app/entities/enumerations/activity-source.model';

export interface IActivityLog {
  id: string;
  patientId?: string | null;
  caseId?: string | null;
  loggedAt?: dayjs.Dayjs | null;
  summary?: string | null;
  detail?: string | null;
  kind?: keyof typeof ActivityKind | null;
  source?: keyof typeof ActivitySource | null;
  authorId?: string | null;
  createdDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
}

export type NewActivityLog = Omit<IActivityLog, 'id'> & { id: null };
