import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
  // Nothing has rendered at this point, so there is no in-app surface to report on. A telemetry
  // exporter throwing during module evaluation once took the patient SPA down for ~12 minutes while
  // every curl and health check returned 200 — leaving this silent is how that happens again.
  console.error('Bootstrap failed', error);
});
