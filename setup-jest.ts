/**
 * New in hc-patient-app — no origin in the web repo, which has no native layer to mock.
 *
 * The single `setupFilesAfterEnv` entry. Everything here exists because a Capacitor plugin called
 * under jsdom either throws or, worse, silently resolves to a shape the app does not expect.
 */

import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

/**
 * Initialises the Angular test environment. This call is required and must come first.
 *
 * jest-preset-angular 15 changed this: `setup-env/zone` EXPORTS `setupZoneTestEnv` rather than
 * running on import, so putting that module path in `setupFilesAfterEnv` — which is what older
 * guides and every v13/v14 example show — imports it and calls nothing. The symptom is
 * "Need to call TestBed.initTestEnvironment() first" on the first spec, then a cascade of
 * "Cannot read properties of null (reading 'ngModule')" on the rest, which reads like a broken
 * component and sends you looking in entirely the wrong place.
 */
setupZoneTestEnv();

/**
 * `Capacitor.isNativePlatform()` is false under Jest, and that is DELIBERATE rather than
 * incidental (patient-mobile.md §7.7).
 *
 * It is the switch that selects the web token store over the secure one, so every spec exercises
 * the in-memory path and none of them touch a keychain that does not exist. Asserting it here means
 * a future change to platform detection fails loudly in one place, instead of quietly changing
 * which storage implementation 146 suites were testing.
 */
jest.mock('@capacitor/core', () => {
  const actual = jest.requireActual('@capacitor/core');
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      isNativePlatform: () => false,
      getPlatform: () => 'web',
      isPluginAvailable: () => false,
    },
  };
});

/**
 * Preferences: an in-memory store, reset between specs. The real plugin is async and backed by
 * SharedPreferences/UserDefaults; the contract specs rely on is only that a set is visible to the
 * next get.
 */
jest.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    Preferences: {
      get: jest.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
      set: jest.fn(async ({ key, value }: { key: string; value: string }) => {
        store.set(key, value);
      }),
      remove: jest.fn(async ({ key }: { key: string }) => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
      keys: jest.fn(async () => ({ keys: [...store.keys()] })),
    },
  };
});

/**
 * App lifecycle. `addListener` resolves to a handle with a `remove()`, because that is what the
 * real plugin returns and services under test call it in ngOnDestroy — returning undefined here
 * turns a teardown into "cannot read properties of undefined".
 */
jest.mock('@capacitor/app', () => ({
  App: {
    addListener: jest.fn(async () => ({ remove: jest.fn(async () => undefined) })),
    removeAllListeners: jest.fn(async () => undefined),
    exitApp: jest.fn(async () => undefined),
    getState: jest.fn(async () => ({ isActive: true })),
  },
}));

/**
 * The system browser. Specs must be able to assert WHAT was opened — the two dead-end screens in
 * §6 decision 2 open patient.abofonsa.com in it, and opening the wrong URL there is a real defect.
 */
jest.mock('@capacitor/browser', () => ({
  Browser: {
    open: jest.fn(async () => undefined),
    close: jest.fn(async () => undefined),
    addListener: jest.fn(async () => ({ remove: jest.fn(async () => undefined) })),
  },
}));

jest.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    show: jest.fn(async () => undefined),
    hide: jest.fn(async () => undefined),
    setAccessoryBarVisible: jest.fn(async () => undefined),
    addListener: jest.fn(async () => ({ remove: jest.fn(async () => undefined) })),
  },
}));

jest.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setStyle: jest.fn(async () => undefined),
    setBackgroundColor: jest.fn(async () => undefined),
    show: jest.fn(async () => undefined),
    hide: jest.fn(async () => undefined),
  },
  Style: { Light: 'LIGHT', Dark: 'DARK', Default: 'DEFAULT' },
}));

jest.mock('@capacitor/splash-screen', () => ({
  SplashScreen: {
    show: jest.fn(async () => undefined),
    hide: jest.fn(async () => undefined),
  },
}));

/**
 * jsdom implements neither. Ionic's gesture/animation layer reads matchMedia at module scope, and
 * `ion-content` observes resizes — without these, importing an Ionic component throws before any
 * test body runs.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

class ResizeObserverStub {
  observe(): void {
    /* no layout under jsdom */
  }
  unobserve(): void {
    /* no layout under jsdom */
  }
  disconnect(): void {
    /* no layout under jsdom */
  }
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

/**
 * The CSS custom properties the theme sets on :root. global.scss is not loaded under Jest, so
 * anything reading a brand colour at runtime — the charts do, in phase 5 — gets an empty string
 * and renders invisible marks rather than failing. Seed the handful that are read from TypeScript.
 */
beforeEach(() => {
  const root = document.documentElement;
  root.style.setProperty('--hc-navy', '#0d3058');
  root.style.setProperty('--hc-gold', '#c59437');
  root.style.setProperty('--hc-ink', '#16202c');
  root.style.setProperty('--hc-grid', '#e9e5dc');
  root.style.setProperty('--hc-series-1', '#256abf');
  root.style.setProperty('--hc-series-2', '#eda100');
  root.style.setProperty('--hc-series-3', '#1baf7a');
});
