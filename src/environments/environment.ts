/**
 * Development environment. Swapped for environment.prod.ts by `fileReplacements` in angular.json.
 *
 * These values replace the web repo's webpack DefinePlugin globals (patient-mobile.md §7.7.2).
 * There is no DefinePlugin under @angular/build:application, and no need for one — nothing lifted
 * from the web reads the bare `SERVER_API_URL` global. It is referenced there only by
 * app.component.ts (rewritten here) and widgets/* (never copied).
 */
export const environment = {
  production: false,

  /**
   * MUST be absolute, and MUST end with '/'. This is the one value that cannot be copied from the
   * web repo, where it is deliberately the empty string in every mode (same-origin, and `ng serve`
   * proxies to the gateway).
   *
   * A Capacitor webview is served from https://localhost, so nothing is same-origin and there is no
   * dev-server proxy in front of it. Relative URLs would resolve against the webview itself and 404
   * against the app's own bundle rather than reaching any gateway.
   *
   * CORS does not apply despite this being cross-origin: capacitor.config.ts sets
   * CapacitorHttp.enabled, which patches XHR onto the native HTTP client. That is load-bearing —
   * the gateway has CORS deliberately disabled and would refuse every preflight.
   *
   * Default points at the quality stack on jacserver (192.168.1.2, private LAN), which is what
   * phase 2's acceptance runs against. Point it at a local gateway (http://10.0.2.2:5505/ from the
   * Android emulator, http://<your-lan-ip>:5505/ from a physical device) when running one.
   */
  SERVER_API_URL: 'http://patient.healthconnect.local/',

  DEBUG_INFO_ENABLED: true,
  VERSION: '0.0.1-dev',
};
