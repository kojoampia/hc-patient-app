/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/shared/language/translate.directive.ts @ 12e418c
 * Divergence: selector [hpmTranslate] -> [hpmTranslate] and the matching input rename. Sets innerHTML, as the web does — safe because the only strings reaching it are our own bundled i18n assets, never user input.
 * Re-sync: see PROVENANCE.md.
 */

import { Input, Directive, ElementRef, OnChanges, OnInit, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { translationNotFoundMessage } from 'app/config/translation.config';

/**
 * A wrapper directive on top of the translate pipe as the inbuilt translate directive from ngx-translate is too verbose and buggy
 */
@Directive({
  standalone: true,
  selector: '[hpmTranslate]',
})
export default class TranslateDirective implements OnChanges, OnInit, OnDestroy {
  private readonly directiveDestroyed = new Subject();

  @Input() hpmTranslate!: string;
  @Input() translateValues?: { [key: string]: unknown };

  constructor(
    private el: ElementRef,
    private translateService: TranslateService,
  ) {}

  ngOnInit(): void {
    this.translateService.onLangChange.pipe(takeUntil(this.directiveDestroyed)).subscribe(() => {
      this.getTranslation();
    });
    this.translateService.onTranslationChange.pipe(takeUntil(this.directiveDestroyed)).subscribe(() => {
      this.getTranslation();
    });
  }

  ngOnChanges(): void {
    this.getTranslation();
  }

  ngOnDestroy(): void {
    this.directiveDestroyed.next(null);
    this.directiveDestroyed.complete();
  }

  private getTranslation(): void {
    this.translateService
      .get(this.hpmTranslate, this.translateValues)
      .pipe(takeUntil(this.directiveDestroyed))
      .subscribe({
        next: value => {
          this.el.nativeElement.innerHTML = value;
        },
        error: () => `${translationNotFoundMessage}[${this.hpmTranslate}]`,
      });
  }
}
