/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/config/translation.config.ts @ 12e418c
 * Divergence: one line — `I18N_HASH` is imported from the generated environments/i18n-hash module
 *   instead of being read as a webpack DefinePlugin global. There is no DefinePlugin under
 *   @angular/build:application (patient-mobile.md §7.7.2), and the hash changes per build so it
 *   cannot be a static `define` in angular.json either. Everything else is unchanged.
 * Re-sync: see PROVENANCE.md.
 */

import { HttpClient } from '@angular/common/http';
import { MissingTranslationHandler, MissingTranslationHandlerParams, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { I18N_HASH } from 'environments/i18n-hash';

export const translationNotFoundMessage = 'translation-not-found';

export class MissingTranslationHandlerImpl implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams): string {
    const key = params.key;
    return `${translationNotFoundMessage}[${key}]`;
  }
}

/**
 * `assets/i18n/` rather than the web's `i18n/`: the merged bundles are emitted into src/assets by
 * tools/merge-i18n.mjs and served from the app's own origin inside the webview. Relative is correct
 * here even though SERVER_API_URL is absolute — these are bundled files, not API calls, so they must
 * NOT go through the gateway.
 */
export function translatePartialLoader(http: HttpClient): TranslateLoader {
  return new TranslateHttpLoader(http, 'assets/i18n/', `.json?_=${I18N_HASH}`);
}

export function missingTranslationHandler(): MissingTranslationHandler {
  return new MissingTranslationHandlerImpl();
}
