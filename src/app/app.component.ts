import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

/**
 * Phase 1 shell. Deliberately empty of logic.
 *
 * Phase 2 adds the APP_INITIALIZER that calls `ApplicationConfigService.setEndpointPrefix()`, and
 * §7.7.3 is explicit that it must resolve BEFORE any HTTP call: both interceptors decide whether to
 * attach the Authorization and X-Acting-As headers by comparing `request.url` against
 * `getEndpointFor('')`, so with an empty prefix they match every host — including third-party ones.
 * Do not be tempted to set the prefix in this constructor when the time comes.
 */
@Component({
  selector: 'hpm-root',
  templateUrl: './app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {}
