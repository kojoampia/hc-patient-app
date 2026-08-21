/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/stat/stat.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';
import { StatFlag } from 'app/entities/enumerations/stat-flag.model';
import { StatSource } from 'app/entities/enumerations/stat-source.model';

export interface IStat {
  id: string;
  patientId?: string | null;
  type?: string | null;
  name?: string | null;
  description?: string | null;
  value?: number | null;
  secondaryValue?: number | null;
  unit?: string | null;
  referenceLow?: number | null;
  referenceHigh?: number | null;
  flag?: keyof typeof StatFlag | null;
  note?: string | null;
  recordedAt?: dayjs.Dayjs | null;
  /** Who took the reading — the patient themselves, a professional, or a device. */
  source?: keyof typeof StatSource | null;
  /** The professional who took it, when a professional did. */
  recordedById?: string | null;
  createdDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
}

export type NewStat = Omit<IStat, 'id'> & { id: null };
