/**
 * New in hc-patient-app — mirrors hc-patient-dashboard's jest.conf.js @ 12e418c in shape, not in
 * versions (patient-mobile.md §7.7).
 *
 * Two deliberate departures from the web repo:
 *
 *  - Jest runs DIRECTLY, not through an Angular builder. The web's `npx jest` does not work at all
 *    ("jest.conf.js carries no transform, since the Angular preset comes from the builder"), which
 *    is why everyone there memorises `npx ng test`. Here the preset is in this file, so `npx jest`,
 *    `npm test` and CI all run the same thing.
 *  - There is NO `pretest: lint` hook in package.json. On the web that hook is why `npm test` has
 *    been failing for months on 172 pre-existing lint problems while the tests themselves pass.
 *    Lint and test are gated separately in CI.
 */

const { createCjsPreset } = require('jest-preset-angular/presets');

module.exports = {
  ...createCjsPreset({
    tsconfig: '<rootDir>/tsconfig.spec.json',
  }),

  /**
   * The same ESM-in-node_modules failure class the web hit with d3, different packages.
   *
   * Ionic ships Stencil-compiled ESM, ionicons ships ESM, the Capacitor packages ship ESM, and
   * dayjs/esm is ESM by name. None of it is transformed by default, so a spec that touches an Ionic
   * component dies on "Unexpected token 'export'" before a single assertion runs.
   *
   * When phase 5 lifts shared/ui/charts, d3 and its transitive ESM deps (internmap, delaunator,
   * robust-predicates) join this list AND need the moduleNameMapper redirection to their UMD
   * builds that web/jest.conf.js documents — transformIgnorePatterns alone was not enough there.
   */
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$|@ionic/|@stencil/|ionicons/|@capacitor/|dayjs/esm)'],

  /**
   * Mirrors the `paths` block in tsconfig.json, so specs resolve lifted `from 'app/...'` imports
   * unedited — the same §7.1 decision that removes most of the mechanical cost of lifting.
   *
   * Written out rather than derived via ts-jest's pathsToModuleNameMapper, which is what the web
   * repo does: that helper needs `require('./tsconfig.json')`, and Node's JSON loader rejects the
   * comment block this project's tsconfig opens with. Two entries is not worth a JSONC parser.
   * Keep in step with tsconfig.json by hand — adding a third alias means editing both.
   */
  moduleNameMapper: {
    '^app/(.*)$': '<rootDir>/src/app/$1',
    '^environments/(.*)$': '<rootDir>/src/environments/$1',

    /**
     * ionicons declares `"./components/ion-icon.js": { "import": … }` with NO `require` condition,
     * and @ionic/angular's standalone icon directive imports exactly that specifier. Jest resolves
     * as CJS, finds no matching condition, and the suite dies with "Cannot find module" before any
     * test runs — importing a single ion-button is enough to trigger it.
     *
     * Mapping straight at the file bypasses the conditional exports; transformIgnorePatterns above
     * then lets its ESM through the transform. Same shape of fix as the web repo's d3 redirection,
     * and for the same underlying reason.
     */
    '^ionicons/components/(.*)$': '<rootDir>/node_modules/ionicons/components/$1',
  },

  /**
   * setup-jest.ts calls `setupZoneTestEnv()` itself. Listing
   * 'jest-preset-angular/setup-env/zone' here instead does NOT work: in v15 that module exports a
   * function rather than running on import, so the environment is never initialised and every spec
   * fails with "Need to call TestBed.initTestEnvironment() first" — followed by a cascade of
   * "Cannot read properties of null (reading 'ngModule')" that looks like a component problem and
   * is not.
   */
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  setupFiles: ['jest-date-mock'],

  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/app/**/@(*.)@(spec.ts)'],
  roots: ['<rootDir>/src'],

  cacheDirectory: '<rootDir>/target/jest-cache',
  coverageDirectory: '<rootDir>/target/test-results/',
  reporters: ['default', ['jest-junit', { outputDirectory: '<rootDir>/target/test-results/', outputName: 'TESTS-results-jest.xml' }]],

  /**
   * A Capacitor webview is served from https://localhost. Setting the same origin here keeps
   * anything that reads location.origin — notably the interceptors' `getEndpointFor('')` prefix
   * comparison (§7.7.3) — behaving under test the way it does on a device.
   */
  testEnvironmentOptions: {
    url: 'https://localhost/',
  },
};
