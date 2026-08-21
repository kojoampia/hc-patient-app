import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

/**
 * Capacitor configuration (patient-mobile.md §7.7.3).
 *
 * Two settings here are not preferences — the app does not reach any backend without them.
 */
const config: CapacitorConfig = {
  appId: 'net.jojoaddison.hcpatient',
  appName: 'BridgeCare',
  webDir: 'www',

  /**
   * `https` rather than Capacitor's `http` default, so the webview origin is https://localhost.
   *
   * An http origin is a non-secure context, which costs the app WebCrypto and — the one that
   * matters here — makes every request to the https gateway mixed content, blocked by the webview
   * before it reaches the network.
   */
  android: {
    /**
     * Off in every build. The one legitimate use is pointing a debug build at a plaintext local
     * gateway; do that by editing android/app/src/main/res/xml/network_security_config.xml for that
     * one host, not by opening cleartext to everything. Phase 7 verifies this is still false.
     */
    allowMixedContent: false,
  },

  server: {
    androidScheme: 'https',
  },

  plugins: {
    /**
     * THE load-bearing setting. Patches XHR/fetch onto the native HTTP client instead of the
     * webview's, which means requests leave the app as native HTTP and **CORS never applies**.
     *
     * Without it the webview is an https://localhost origin calling patient.abofonsa.com, which is
     * cross-origin, so the webview would send a preflight — and the patient gateway has CORS
     * deliberately disabled. Every single API call would fail the preflight and never be sent. This
     * is not a tuning knob: turning it off breaks the whole app, and it breaks it in a way that
     * looks like the backend is down.
     *
     * The cost is documented in §8.4.1 and is worse than it sounds: a raw `fetch()`, an
     * `<img src="…/api/…">` or `Browser.open(apiUrl)` bypasses Angular's interceptor chain while
     * still going through the native client — no Authorization header, no X-Acting-As, and a 200
     * carrying the wrong patient's record. All HTTP goes through HttpClient, always.
     */
    CapacitorHttp: {
      enabled: true,
    },

    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#0d3058',
      showSpinner: false,
      androidSplashResourceName: 'splash',
    },

    /**
     * `native`, not `body` or `ionic`.
     *
     * `body` resizes the whole document, which on this app means the acting-as banner — a safety
     * control that must be visible at all times (§7.4) — scrolls away when the keyboard opens on
     * the sign-in screen. `ionic` has the same effect through Ionic's own handling.
     *
     * `native` lets Android pan the window instead, so the focused field comes into view and the
     * banner stays where it is. The cost is that a very short screen can put the field under the
     * keyboard; `ion-content` scrolls, so it does not.
     */
    Keyboard: {
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
    },

    /**
     * The status bar is styled from the app rather than the theme, because the shell's top element
     * is the banner and its colour changes: navy-on-cream when viewing your own record, warn when
     * acting for somebody. Phase 3's banner owns the inset; this only makes the bar's ICONS legible
     * against it.
     */
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0d3058',
      overlaysWebView: false,
    },
  },
};

export default config;
