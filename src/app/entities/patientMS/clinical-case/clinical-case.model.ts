/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/clinical-case/clinical-case.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';
import { IRecommendation } from 'app/entities/patientMS/recommendation/recommendation.model';
import { CaseStatus } from 'app/entities/enumerations/case-status.model';

export interface IClinicalCase {
  id: string;
  patientId?: string | null;
  caseNumber?: number | null;
  title?: string | null;
  openedAt?: dayjs.Dayjs | null;
  closedAt?: dayjs.Dayjs | null;
  brief?: string | null;
  status?: keyof typeof CaseStatus | null;
  symptoms?: string | null;
  diagnosis?: string | null;
  assignedProfessionalId?: string | null;
  assignedRosterId?: string | null;
  /**
   * When a professional retired this case from the working queue, or null while it is live.
   *
   * A nullable instant rather than a boolean: what is asked about an archived case afterwards is
   * who and why, and a boolean records that it happened and loses both.
   */
  archivedAt?: dayjs.Dayjs | null;
  archivedById?: string | null;
  archiveReason?: string | null;
  recommendations?: IRecommendation[] | null;
}

export type NewClinicalCase = Omit<IClinicalCase, 'id'> & { id: null };
