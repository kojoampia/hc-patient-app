/**
 * Production environment. See environment.ts for why SERVER_API_URL must be absolute and why
 * being cross-origin is safe here (CapacitorHttp patches XHR onto the native client, so the
 * gateway's deliberately-disabled CORS is never consulted).
 */
export const environment = {
  production: true,

  /** The patient subsystem's edge, on webserver (199.247.5.252). Trailing slash required. */
  SERVER_API_URL: 'https://patient.abofonsa.com/',

  DEBUG_INFO_ENABLED: false,
  VERSION: '0.0.1',
};
