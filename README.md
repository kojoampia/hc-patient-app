# hc-patient-app

The BridgeCare patient portal as an Android app — Ionic Angular + Capacitor.

`patient-mobile.md` is the **plan of record**: §1–§5 are the backend contract, §6 the decisions,
§7–§8 the port. `PROVENANCE.md` indexes every file copied out of `hc-patient-dashboard`. Read the
plan before starting a phase; where it and the code disagree, the code wins.

**Status: phase 1 of 8.** Scaffold and theme. There is one route, `theme-check`, and it exists to
make the theming falsifiable on a device. No auth, no data layer, no shell yet.

## Toolchain — pin these two or lose an afternoon

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
```

**`JAVA_HOME` is not optional and `java -version` will not catch it being wrong.** The `java` on
`PATH` in this workspace is Oracle 25, which does have a compiler, so the usual check passes while
Gradle picks up something else. Two ways this goes wrong, both from `CLAUDE.md`'s JDK trap:

- `/usr/lib/jvm/java-25-openjdk-amd64` is a **JRE with no `javac`**. Gradle's failure reads
  `does not provide the required capabilities: [JAVA_COMPILER]`, which sends you looking at
  toolchain configuration rather than at a missing binary.
- A **warm** Gradle build still installs a **stale APK**, so the app appears to run while ignoring
  your change. Verify with a clean build, never an incremental one.

Node is 24.18.0 (`engines` allows ^20.19 / ^22.12 / >=24). Angular is pinned to **20.3.27** to match
`web` exactly, which is what lets files be lifted with zero edits — see `patient-mobile.md` §6
decision 1.

## Commands

```bash
npm install

npm start                  # dev server on 4200 (browser only — see the caveat below)
npm run build              # development build → www/
npm run build:prod         # production build → www/

npm test                   # Jest. No pretest lint hook, deliberately.
npm run test:ci            # + coverage, 2 workers
npm run lint               # ESLint, gated separately from tests

npm run i18n               # merge bundles + the key-equality gate (runs on pre{start,build,test})
npm run provenance         # diff lifted files against a sibling ../web checkout

npm run cap:sync           # build:prod + npx cap sync android
npm run android:debug      # cap:sync + ./gradlew assembleDebug
npm run android:release    # cap:sync + ./gradlew assembleRelease
```

**`npm start` runs in a browser, where `CapacitorHttp` is not active.** Requests go through the
browser's own XHR, so they are subject to CORS — and the patient gateway has CORS deliberately
disabled. The dev server is useful for layout and nothing else. Anything touching the network has to
be checked on a device or emulator.

### Lint and test are separate on purpose

There is no `pretest: lint` hook. On `web` that hook is why `npm test` has been failing for months
on pre-existing lint problems while the tests themselves pass, and why everyone there runs
`npx ng test` instead. Gate them separately in CI.

### The i18n gate

`npm run i18n` merges `src/i18n/<locale>/*.json` into `src/assets/i18n/<locale>.json`, writes
`src/environments/i18n-hash.ts`, and **fails the build when the three locales' key sets differ**.
They were 1199 / 1198 / 1189 when this app was scaffolded; the 11-key gap is closed and the gate
keeps it closed. A missing key is otherwise invisible — it renders as
`translation-not-found[some.key]` at runtime, in a language nobody on the team is testing as.

Both outputs are generated and gitignored. `src/i18n/` is the source.

## Layout

```
src/theme/       _tokens, _components, _utilities   lifted verbatim from web
                 ionic-bridge.scss                  $hc-* -> --ion-*   (new)
                 mobile.scss                        390px overrides only (new)
src/i18n/        en, fr, de                         source bundles; merged at build time
src/app/         theme-check/                       phase 1 acceptance screen; delete in phase 5
tools/           merge-i18n.mjs, check-provenance.mjs
android/         committed Capacitor output
```

`src/global.scss` imports the theme in a **fixed order** — Ionic, tokens, bridge, utilities,
components, mobile. The bridge has to sit between tokens and components; the file says why.

## Two things that will bite

- **Nothing hardcodes a hex.** All visual truth is in `_tokens.scss`, and `ionic-bridge.scss` is the
  only place `--ion-*` is written. That property is what made this port tractable — protect it.
- **`ion-button color="secondary"` renders dark text on gold, and must.** `#c59437` on white is
  2.74:1 and fails AA at every size. Never "fix" it to white to match the navy button.

## Where it points

`SERVER_API_URL` must be **absolute and end in `/`** — a Capacitor webview is `https://localhost`,
so nothing is same-origin and there is no dev-server proxy. It is cross-origin by design and safe
because `CapacitorHttp` patches XHR onto the native client, where CORS does not apply.

| Build | Value |
| ----- | ----- |
| development | `http://patient.healthconnect.local/` — the quality stack on `jacserver`, private LAN |
| production | `https://patient.abofonsa.com/` |

Point development at a local gateway when running one: `http://10.0.2.2:5505/` from the Android
emulator, `http://<your-lan-ip>:5505/` from a physical device.
