/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/report/report.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';

export interface IReport {
  id: string;
  category?: string | null;
  description?: string | null;
  summary?: string | null;
  name?: string | null;
  url?: string | null;
  patientId?: string | null;
  caseId?: string | null;
  authorId?: string | null;
  reportDate?: dayjs.Dayjs | null;
  createdDate?: dayjs.Dayjs | null;
  modifiedDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
  modifiedBy?: string | null;
}

export type NewReport = Omit<IReport, 'id'> & { id: null };
