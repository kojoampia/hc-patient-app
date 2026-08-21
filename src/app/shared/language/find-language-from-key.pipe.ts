/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/shared/language/find-language-from-key.pipe.ts @ 12e418c
 * Divergence: hpd -> hpm throughout; SharedModule (never copied) replaced by the lifted TranslateDirective.
 * Re-sync: see PROVENANCE.md.
 */

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  standalone: true,
  name: 'findLanguageFromKey',
})
export default class FindLanguageFromKeyPipe implements PipeTransform {
  private languages: { [key: string]: { name: string; rtl?: boolean } } = {
    en: { name: 'English' },
    fr: { name: 'Français' },
    de: { name: 'Deutsch' },
    // jhipster-needle-i18n-language-key-pipe - JHipster will add/remove languages in this object
  };

  transform(lang: string): string {
    return this.languages[lang].name;
  }
}
