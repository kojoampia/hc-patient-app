/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/config/authority.constants.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

export enum Authority {
  ADMIN = 'ROLE_ADMIN',
  USER = 'ROLE_USER',
  /**
   * A patient. Granted at registration alongside USER, which every existing route guard still checks.
   *
   * It tells a patient from a clinician for menus and navigation. It grants no access to any record — that comes from
   * the backend resolving the signed-in email to a profile.
   */
  PATIENT = 'ROLE_PATIENT',
  /**
   * Somebody nominated to act for a patient.
   *
   * Informational only, and deliberately so: an angel's authority comes from an ACTIVE care delegation that the
   * backend re-reads on every request, not from holding this role. Guarding a screen on ANGEL alone would let somebody
   * whose delegation was revoked keep the menu entry.
   */
  ANGEL = 'ROLE_ANGEL',
}
