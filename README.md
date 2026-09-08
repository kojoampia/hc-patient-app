# hc-patient-app

The BridgeCare patient portal as an Android app — Ionic Angular + Capacitor.

`patient-mobile.md` is the **plan of record**: §1–§5 are the backend contract, §6 the decisions,
§7–§8 the port. `PROVENANCE.md` indexes every file copied out of `hc-patient-dashboard`. Read the
plan before starting a phase; where it and the code disagree, the code wins.

**Status: phase 8 of 8, Android verified and iOS unverified.** The portal is built — sign-in, the
acting-as fork, the shell, the data layer, all thirteen screens, the lock and the release path. The
Android app has been built, installed and driven on a physical handset. **The iOS project is
configured but has never been compiled** — see "iOS" below before trusting any of it.

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
npm run android:release    # cap:sync + ./gradlew assembleRelease   (APK — sideloading and lint)
npm run android:bundle     # cap:sync + ./gradlew bundleRelease     (AAB — the Play upload)
```

### Versioning

`package.json`'s `version` is the **single source**. `android/app/build.gradle` parses it and
derives both Android values — `versionName` is the string verbatim, `versionCode` is
`major * 10000 + minor * 100 + patch`, so `0.0.1` → `1` and `1.2.3` → `10203`. Bump `package.json`
and nothing else.

Two guards live in that file, and both fail the build rather than the upload. A version that does
not start `major.minor.patch` is rejected outright; so is a minor or patch above 99, because the
formula stops being monotonic there (`1.0.100` and `1.1.0` would both derive `10100`).

A prerelease shares its release's code — `1.2.0-rc.1` and `1.2.0` both derive `10200`. Pass
`-PversionCode=<n>` to break the tie if both are ever uploaded. That override is also the way to
re-upload a build Play rejected for something that is not the app — a signing mistake, a bad
listing — where bumping the real version would misdescribe what changed.

### Signing a release

`assembleRelease` and `bundleRelease` produce an **unsigned** artifact unless
`android/keystore.properties` exists. That is deliberate: the release path stays buildable by people
who should not hold the signing key, and an unsigned artifact cannot be installed or uploaded by
accident.

To sign, create `android/keystore.properties` — which `.gitignore` already excludes, along with
`*.keystore` and `*.jks`:

```properties
storeFile=/absolute/path/to/hc-patient.jks
storePassword=…
keyAlias=hcpatient
keyPassword=…
```

**The keystore is a credential and belongs wherever the platform's other secrets live.** Losing it
means never being able to update this app on an installed device again; leaking it means somebody
else can publish as this app. It is not in this repository and must not be.

### Two keys, and the one the deep links need

Under Play App Signing — which is not optional for a new app — this keystore is the **upload key**.
Google verifies the upload with it, then strips that signature and re-signs the artifact with a
separate **app signing key** it holds. What lands on a handset is signed by Google's certificate,
not by `hc-patient.jks`.

That distinction decides one thing in this repo. Deep links are configured for
`patient.abofonsa.com` but will show a chooser rather than opening directly until
`/.well-known/assetlinks.json` is published there — and the SHA-256 in that file must be the **app
signing certificate's**, copied from Play Console → Setup → App signing. The upload key's
fingerprint is the wrong one and fails silently: Android simply does not verify the link, which is
indistinguishable from not having published the file at all.

Sideloaded builds signed directly by `hc-patient.jks` are the exception — they verify against the
upload key's fingerprint. Publishing both fingerprints in `assetlinks.json` is legitimate and is
what you want while the app is still being tested off-store.

### Uploading

Play takes an **App Bundle**, not an APK — `npm run android:bundle`, output at
`android/app/build/outputs/bundle/release/app-release.aab`. `assembleRelease` stays because a
signed APK is what you sideload for testing, and because of the lint pass below.

The script runs `clean` first for the reason the CI workflow does: a warm Gradle build will happily
package stale web assets, and a stale artifact is worse when it is the one somebody uploads.

### Why `assembleRelease` matters even unsigned

It runs Android lint; `assembleDebug` does not. That is what caught a malformed
`network_security_config.xml` which several debug builds had accepted without complaint.

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
src/theme/          _tokens, _components, _utilities   lifted verbatim from web
                    ionic-bridge.scss                  $hc-* -> --ion-*   (new)
                    mobile.scss                        390px overrides only (new)
src/i18n/           en, fr, de                         source bundles; merged at build time
src/app/core/       lifted: config, interceptors, request, util, auth
src/app/core/native/  token store, secure store, biometrics, lifecycle, lock, with-prompt
src/app/shell/      tabs, banner, record picker, more sheet, nav, back-button policy
src/app/auth/       login, lock
src/app/fork/       SessionBootstrapService — the §3.2 five-case fork
src/app/deadends/   onboarding-required, invitations-required
src/app/portal/     data/ (Resource<T>, PortalDataService) + the 13 screens
src/app/entities/   lifted: 15 models + services, enumerations
src/app/shared/     lifted ui kit and the language directive
tools/              merge-i18n.mjs, check-provenance.mjs
android/            committed Capacitor output
.github/workflows/  ci.yml — one workflow, node job + android job
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

| Build       | Value                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| development | `http://patient.healthconnect.local/` — the quality stack on `jacserver`, private LAN |
| production  | `https://patient.abofonsa.com/`                                                       |

Point development at a local gateway when running one: `http://10.0.2.2:5505/` from the Android
emulator, `http://<your-lan-ip>:5505/` from a physical device.

## iOS — configured, not verified

**Nothing in `ios/` has ever been built or run.** It was generated and configured on a Linux
machine with no Xcode, so every claim in this section is a claim about configuration, not about a
working app. Treat the first real build as a debugging session, not a formality.

Capacitor 8 uses **Swift Package Manager**, not CocoaPods, so there is no `pod install` step.

```bash
npm run build:prod && npx cap sync ios
npx cap open ios          # needs macOS + Xcode
```

### What is configured

| Concern                      | Where                                  | Note                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Face ID prompt               | `NSFaceIDUsageDescription`             | **Required.** iOS _terminates_ the app the first time it touches Face ID without it — its absence is a crash, not a missing prompt.                                                                                                                                                                                                         |
| Cleartext                    | `NSAppTransportSecurity`               | `NSAllowsArbitraryLoads: false`. `NSAllowsLocalNetworking: true` so a dev build can reach `patient.healthconnect.local` over http **without** weakening ATS for the public internet — the narrow tool Android could not offer (see `network_security_config.xml`).                                                                          |
| Export compliance            | `ITSAppUsesNonExemptEncryption: false` | Avoids the prompt on every App Store submission.                                                                                                                                                                                                                                                                                            |
| Keychain accessibility       | `core/native/secure-store.ts`          | `whenUnlockedThisDeviceOnly` → `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`. Verified against the plugin's Swift: the JS proxy forwards it on every `setItem`, and its own default is `whenUnlocked` — so awaiting the store's `ready` promise is what stops a race writing a token that migrates to a new device in an encrypted backup. |
| Keychain surviving uninstall | `SessionTokenService.clearIfFirstRun`  | Detected with a Preferences flag. Verified: Capacitor Preferences on iOS is `UserDefaults.standard`, which **is** cleared on uninstall while the Keychain is not — which is exactly what makes the detection work.                                                                                                                          |
| Icon and splash              | `Assets.xcassets`                      | Generated from the BridgeCare seal. The icon is deliberately **RGB with no alpha** — the App Store rejects a transparent icon.                                                                                                                                                                                                              |

### What still needs a Mac, and a person

1. **Wire `App.entitlements` into the target.** The file exists with the associated-domains entry
   for `patient.abofonsa.com`, but `CODE_SIGN_ENTITLEMENTS` is not set in `project.pbxproj`. That
   edit was left undone on purpose: `project.pbxproj` is a fragile format and editing it blind, with
   no way to open the project afterwards, is how you get a repository that no longer builds. In
   Xcode it is one checkbox — Signing & Capabilities → + Capability → Associated Domains.
2. **Publish `apple-app-site-association`** on `patient.abofonsa.com`, carrying the Team ID. This is
   the iOS counterpart of the `assetlinks.json` Android is already waiting on, and like it, it
   cannot be produced before the signing identity exists.
3. **Run §8.3's five fork outcomes on a device.** They are phase 8's stated acceptance and none of
   them has been exercised on iOS.
4. **Check the safe areas on a notched device.** The acting-as banner owns the top inset and
   `--ion-safe-area-top` is zeroed _scoped to `ion-tabs`_ (§7.4.1); if that is wrong the inset
   doubles, and it is invisible anywhere but a real notched screen.
5. **CI does not build iOS.** The workflow's Android job runs on `ubuntu-latest`; an iOS job needs a
   `macos-latest` runner, which is a cost decision rather than a technical one.
