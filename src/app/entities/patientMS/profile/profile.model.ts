/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/profile/profile.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';

import { IAddress } from 'app/entities/patientMS/address/address.model';

export interface IProfile {
  id: string;
  patientId?: string | null;
  firstName?: string | null;
  middleNames?: string | null;
  lastName?: string | null;
  membership?: string | null;
  birthDate?: dayjs.Dayjs | null;
  sex?: string | null;
  bloodGroup?: string | null;
  mobilePhone?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  cardType?: string | null;
  cardNumber?: string | null;
  contacts?: string | null;
  /**
   * A document since care onboarding needed a structured address — a digital address, a town and a region cannot be
   * recovered from '5 Ankobra River Street' once somebody has typed it that way. Anything rendering this must format
   * it; interpolating it directly prints [object Object].
   */
  address?: IAddress | null;
  team?: string | null;
  imageUrl?: string | null;
  about?: string | null;
  socialHandle?: string | null;
  careAngelName?: string | null;
  careAngelPhone?: string | null;
  /** A display cache of the active delegation. Never what decides whether that person may act — the backend re-reads
   *  the delegation itself, so this being stale makes a screen wrong rather than a permission wrong. */
  careAngelEmail?: string | null;
  careAngelLogin?: string | null;
  /** Null means COMPLETE: every profile written before onboarding existed reads null. */
  onboardingStatus?: 'IN_PROGRESS' | 'COMPLETE' | null;
  onboardingStep?: number | null;
  onboardingCompletedAt?: dayjs.Dayjs | null;
}

export type NewProfile = Omit<IProfile, 'id'> & { id: null };
