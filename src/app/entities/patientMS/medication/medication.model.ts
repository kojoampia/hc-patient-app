/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/medication/medication.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';
import { MedicationStatus } from 'app/entities/enumerations/medication-status.model';

export interface IMedication {
  id: string;
  name?: string | null;
  description?: string | null;
  patientId?: string | null;
  caseId?: string | null;
  prescription?: string | null;
  dosage?: string | null;
  status?: keyof typeof MedicationStatus | null;
  startedOn?: dayjs.Dayjs | null;
  prescribedById?: string | null;
  createdDate?: dayjs.Dayjs | null;
  modifiedDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
  modifiedBy?: string | null;
}

export type NewMedication = Omit<IMedication, 'id'> & { id: null };
