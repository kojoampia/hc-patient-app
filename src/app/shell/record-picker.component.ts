/**
 * New in hc-patient-app. The web's equivalent is an inline dialog in the shell; this is an
 * `ion-modal`, and its dismissal rules are load-bearing (patient-mobile.md §7.4.4).
 */

import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { IonContent, IonIcon, IonItem, IonLabel, IonList, IonNote } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { ActingAsChoice, ActingAsService } from 'app/core/auth/acting-as.service';

@Component({
  selector: 'hpm-record-picker',
  templateUrl: './record-picker.component.html',
  styleUrl: './record-picker.component.scss',
  imports: [IonContent, IonList, IonItem, IonLabel, IonNote, IonIcon, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordPickerComponent {
  private readonly actingAs = inject(ActingAsService);

  /**
   * True when this is the undismissable `mustChoose` fork rather than a voluntary switch from the
   * banner. The same list serves both; only the escape routes differ.
   */
  readonly forced = input(false);

  readonly chosen = output<string>();

  readonly choices = this.actingAs.available;
  readonly currentId = this.actingAs.current;

  select(choice: ActingAsChoice): void {
    this.chosen.emit(choice.patientId);
  }
}
