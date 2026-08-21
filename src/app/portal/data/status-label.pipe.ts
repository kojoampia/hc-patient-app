/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/status-label.pipe.ts @ 12e418c
 * Divergence: pipe name hpdStatus -> hpmStatus, the sweeping prefix change (§7.2).
 * Re-sync: see PROVENANCE.md.
 */

import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { translationNotFoundMessage } from 'app/config/translation.config';

import { humanise } from './portal-format';

/**
 * A record's status in the words a patient uses, not the words the database uses.
 *
 *   <span class="hc-pill">{{ item.status | hpdStatus }}</span>
 *
 * The portal used to render every status through {@link humanise}, which sentence-cases the enum
 * and stops there: `HIGH` became "High", `TREATMENT` became "Treatment", `OK` became "Ok". Those
 * are the backend's words. On an emergency the difference is the whole point — a patient reads
 * **Urgent**, and "High" is a severity grading they were never shown the scale for.
 *
 * The enum values are unique across the domains the portal renders, so one flat map covers cases,
 * medications, appointments, emergencies, allergies and vitals. A value with no entry falls back
 * to `humanise`, so a status the backend adds tomorrow renders as words rather than as a missing
 * translation key.
 *
 * <p>**A missing key does not come back as the key.** {@link MissingTranslationHandlerImpl} answers
 * with `translation-not-found[<key>]`, so comparing the result against the key never matched and the
 * fallback was unreachable: every unrecognised status rendered that sentinel on screen instead of a
 * word. Compare against the sentinel, not the key — as `AlertService` already does.</p>
 *
 * <p>**Pass a `domain` where the flat map does not apply.** The uniqueness above holds for the
 * clinical enums and not beyond them: `Membership.status` is a free `String` in `patient.jdl`, and
 * its `ACTIVE` is a subscription that is running, while `patientPortal.status.ACTIVE` is a
 * medication being taken — "Taking now". Rendering a plan as "Taking now" is a worse failure than
 * rendering nothing, because it is plausible. `{{ plan.status | hpdStatus: 'membership' }}` looks in
 * `patientPortal.status.membership.*` first and only then in the flat map. The scoped lookup is
 * upper-cased, because a free `String` arrives however the backend wrote it — the demo seed says
 * `active`. The fallback still humanises the value as it arrived.</p>
 *
 * Impure, like `TranslatePipe` itself: the label has to change when the language does, and a pure
 * pipe would hold the one it was first given.
 */
@Pipe({
  name: 'hpmStatus',
  standalone: true,
  pure: false,
})
export class StatusLabelPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(value: string | null | undefined, domain?: string): string {
    if (!value) {
      return '—';
    }
    const scoped = domain ? this.lookup(`patientPortal.status.${domain}.${value.toUpperCase()}`) : null;
    return scoped ?? this.lookup(`patientPortal.status.${value}`) ?? humanise(value);
  }

  /** The label for `key`, or `null` when the bundle has no entry for it. */
  private lookup(key: string): string | null {
    const label: string = this.translate.instant(key);
    const missing = label === key || label.startsWith(translationNotFoundMessage);
    return missing ? null : label;
  }
}
