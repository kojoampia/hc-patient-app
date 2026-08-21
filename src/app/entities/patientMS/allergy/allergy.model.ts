/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/allergy/allergy.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';
import { AllergyCategory } from 'app/entities/enumerations/allergy-category.model';
import { AllergySeverity } from 'app/entities/enumerations/allergy-severity.model';

export interface IAllergy {
  id: string;
  patientId?: string | null;
  name?: string | null;
  category?: keyof typeof AllergyCategory | null;
  severity?: keyof typeof AllergySeverity | null;
  reaction?: string | null;
  notedOn?: dayjs.Dayjs | null;
  notedById?: string | null;
  createdDate?: dayjs.Dayjs | null;
  modifiedDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
  modifiedBy?: string | null;
}

export type NewAllergy = Omit<IAllergy, 'id'> & { id: null };
