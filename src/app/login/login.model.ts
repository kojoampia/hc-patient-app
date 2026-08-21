/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/login/login.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

export class Login {
  constructor(
    public username: string,
    public password: string,
    public rememberMe: boolean,
  ) {}
}
