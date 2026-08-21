/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/address/address.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';

export interface IAddress {
  id: string;
  digitalAddress?: string | null;
  streetAddress?: string | null;
  areaCode?: string | null;
  town?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  region?: string | null;
  country?: string | null;
  createdDate?: dayjs.Dayjs | null;
  modifiedDate?: dayjs.Dayjs | null;
  createdBy?: string | null;
  modifiedBy?: string | null;
}

export type NewAddress = Omit<IAddress, 'id'> & { id: null };
