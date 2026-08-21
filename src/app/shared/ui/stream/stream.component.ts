/**
 * New in hc-patient-app — no origin in the web repo, because the web has nothing to render: its
 * streams only ever produce arrays.
 *
 * **ONE COMPONENT RENDERS ALL THREE STATES SO THE TWELVE STREAMS CANNOT DRIFT APART** (§7.5).
 *
 * That is the entire justification for it existing. Twelve screens each writing their own
 * `@if (loading) … @else if (failed) …` is twelve chances for one of them to render a failure as an
 * empty list, which is the defect this whole phase is about. Here the decision is made once.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonButton, IonIcon, IonSkeletonText } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { Resource } from 'app/portal/data/resource';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'hpm-stream',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonSkeletonText, IonButton, IonIcon, TranslateModule, EmptyStateComponent],
  templateUrl: './stream.component.html',
  styleUrl: './stream.component.scss',
})
export class StreamComponent<T> {
  /** The stream to render. Anything from PortalDataService, or profileState$/careTeamState$. */
  readonly resource = input.required<Resource<readonly T[]>>();

  /** Empty-state copy, per list. */
  readonly emptyTitleKey = input('patientPortal.empty.title');
  readonly emptyMessageKey = input<string>();
  readonly emptyIcon = input('file-tray-outline');

  /**
   * How many skeleton rows to draw, and how tall each is.
   *
   * §7.5: "skeleton rows sized to the real row". A 14px placeholder under a 64px row makes the
   * content jump when it lands, which reads as a glitch rather than as loading.
   */
  readonly skeletonRows = input(3);
  readonly skeletonRowHeight = input(64);

  readonly retried = output<void>();

  readonly isLoading = computed(() => this.resource().state === 'loading');
  readonly isFailed = computed(() => this.resource().state === 'failed');

  readonly isEmpty = computed(() => {
    const state = this.resource();
    return state.state === 'loaded' && state.value.length === 0;
  });

  readonly hasRows = computed(() => {
    const state = this.resource();
    return state.state === 'loaded' && state.value.length > 0;
  });

  readonly skeletonList = computed(() => Array.from({ length: this.skeletonRows() }, (_, i) => i));

  /**
   * The failure message, keyed off status — **never a raw error string** (§7.5).
   *
   * "HttpErrorResponse: Unknown Error" tells a patient nothing and looks like the app broke. What
   * they need to know is whether to check their signal, ask for access, or try again.
   */
  readonly failureKey = computed(() => {
    const state = this.resource();
    if (state.state !== 'failed') {
      return '';
    }
    if (state.status === null || state.status === 0) {
      return 'patientPortal.stream.offline';
    }
    if (state.status === 403) {
      return 'patientPortal.stream.forbidden';
    }
    return 'patientPortal.stream.generic';
  });

  /**
   * 403 means this account may not open this record — retrying changes nothing, and offering the
   * button implies otherwise. Every other failure is worth another go.
   */
  readonly canRetry = computed(() => {
    const state = this.resource();
    return state.state === 'failed' && state.status !== 403;
  });
}
