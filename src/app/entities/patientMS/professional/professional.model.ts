/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/professional/professional.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';

export interface IProfessional {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  /** "Dr.", "Prof.", "Sr." — how this person is addressed, when the record says. */
  honorific?: string | null;
  role?: string | null;
  specialty?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  imageUrl?: string | null;
  initials?: string | null;
  location?: string | null;
  teamId?: string | null;
  createdDate?: dayjs.Dayjs | null;
  modifiedDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
  modifiedBy?: string | null;
}

export type NewProfessional = Omit<IProfessional, 'id'> & { id: null };
