# hc-patient-app — plan of record

**Status: built, and not walked on a device.** The app landed on 2026-08-21 (PR #2, `d19ca07`) — Ionic 9, Angular
20.3, Capacitor 8, all thirteen portal screens, the Android release path and the iOS platform. This header said "no
code" until 2026-08-23. What has _not_ happened is the by-hand verification every phase in §7.8 ends with: the five
accounts and five outcomes of §8.3, airplane mode on every panel, biometric unlock and the no-lock-loop case, safe
areas on a notched device. Treat Android as built-but-unwalked and **iOS as configured and unverified**, which is
what its own commit says.

**§1–§5 are the contract**, frozen as Phase D of `docs/onboarding.md` so that the client can be started without
re-reading three backends. **§6–§8 are the plan**, added 2026-08-21: the decisions that were open, and the port they
imply. **`PARITY.md` is the sweep against the web app** (2026-08-23) — what is at parity, what diverges on purpose,
and the one real gap.

The contract below is taken from **`docs/onboarding.md` §16, not from its §4–§10.** Those earlier sections describe
what was _planned_; §16 records what was _built_, and the two differ in ways that matter to a client — the step
endpoints are named rather than numbered, the status response carries `onboarded`, and `/mine` returns the patient's
name. Where this file and the code disagree, **the code is right and this file is the bug**; §1–§5 were written on
2026-08-20 against `api` `cec2c24` and `gateway` `b2314cf`, and the port plan against `web` `12e418c`.

---

## 1 · Which service owns what

There is no transaction anywhere in this journey, and no service that owns it end to end. **The client is the
orchestrator**, and that is a deliberate consequence of the two backends being separate and Mongo running standalone.

| Concern                                       | Service                                        | Why it cannot be the other one                                                      |
| --------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| Registration, activation, password reset, JWT | `gateway`                                      | It is the only service with a `User` domain. `api` runs `skipUserManagement: true`. |
| Creating a care angel's account               | `gateway` (`POST /api/care-angels`)            | Same reason — creating a user is something no other service can do.                 |
| Sending any mail                              | `gateway`                                      | `api` has the mail dependency in its pom and no `MailService`.                      |
| The clinical record, onboarding, delegation   | `api`                                          | It owns the domain, and `PatientScope` is the whole authorization model.            |
| Membership plans                              | `gateway` proxy to Abofonsa (`GET /api/plans`) | A deliberate exception to discovery-based routing.                                  |

Everything under `/services/hcpatientservice/**` is `api`; everything under `/api/**` at the edge is the gateway. A
client builds URLs through one place that knows that split, exactly as the web client's `ApplicationConfigService`
does. **Never hardcode a host or a `/services/...` prefix at a call site.**

---

## 2 · The journey

```
POST /api/register                      gateway   → ROLE_USER + ROLE_PATIENT
GET  /api/activate?key=…                gateway   → from the activation mail
POST /api/authenticate                  gateway   → { id_token }
GET  /services/hcpatientservice/api/onboarding/status
                                        api       → where to send them next
   ├─ onboarded: true  ─────────────────────────→ the portal
   └─ onboarded: false ─────────────────────────→ the wizard, resumed at `step`
```

### 2.1 · The five steps

Named, not numbered. The five payloads are genuinely different shapes, and one numbered handler taking all five could
only be typed as a map or as a wrapper of five optional blocks — both of which make the contract _harder_ to implement
against, which is the opposite of what freezing it is for.

```
POST  /api/onboarding                    step 1 — the bootstrap. Creates the Profile.
PATCH /api/onboarding/care-angel         step 2
PATCH /api/onboarding/baseline           step 3
PATCH /api/onboarding/current-state      step 4
PATCH /api/onboarding/identification     step 5
POST  /api/onboarding/complete
GET   /api/onboarding/status
```

All five PATCHes accept `application/json` **or** `application/merge-patch+json`. All return the updated `Profile`.

**`POST /api/onboarding` is the one path in the service that may run before a `Profile` exists**, it acts only on the
token's email, and it succeeds exactly once per account. Do not look for a second way in; there isn't one, and adding
one is the change the whole security design exists to prevent.

**Each step saves before the next is shown.** There is no transaction to wrap the journey in, so each step is
independently meaningful instead — a client that batches all five and submits at the end throws away the only
resumability the design has.

### 2.2 · The payloads

```jsonc
// POST /api/onboarding — step 1
{ "firstName": "", "middleNames": "", "lastName": "", "birthDate": "1976-04-19", "sex": "",
  "mobilePhone": "", "phoneNumber": "",
  "address": { "digitalAddress": "", "streetAddress": "", "areaCode": "", "town": "",
               "city": "", "district": "", "state": "", "region": "" } }

// PATCH /api/onboarding/care-angel — step 2
{ "firstName": "", "lastName": "", "fullName": "", "phone": "", "email": "", "contacts": "",
  "standby": { "firstName": "", "lastName": "", "fullName": "", "phone": "", "email": "" },
  "advanceConsent": true }

// PATCH /api/onboarding/baseline — step 3
{ "heightCm": 0, "weightKg": 0, "systolic": 0, "diastolic": 0,
  "heartRateBpm": 0, "bloodSugarMmolL": 0 }        // the last two optional

// PATCH /api/onboarding/current-state — step 4
{ "bloodGroup": "O+",
  "conditions":  [{ "name": "", "description": "" }],                    "noConditions":  false,
  "allergies":   [{ "name": "", "category": "", "severity": "", "reaction": "" }], "noAllergies": false,
  "medications": [{ "name": "", "dosage": "", "prescription": "", "status": "", "startedOn": "" }],
  "noMedications": false }

// PATCH /api/onboarding/identification — step 5
{ "cardType": "", "cardNumber": "" }               // required; "none" is not an accepted answer

// GET /api/onboarding/status
{ "status": "IN_PROGRESS", "step": 2, "profileId": "…", "onboarded": false }
```

**The `noConditions` / `noAllergies` / `noMedications` flags are boxed booleans and null means _unanswered_** — which
is a different state from "none", and the reason step 4 can tell them apart. Send `false`/`true` deliberately.
Jackson 3 refuses to bind an absent property onto a primitive and reports only `"Failed to read request"` with no
cause, so a client that omits a field it thinks is optional gets an error naming nothing.

### 2.3 · Two rules about `status`

- **Read `onboarded`. Do not re-derive it from `status`.** A null `onboardingStatus` means `COMPLETE`, not
  `NOT_STARTED` — every patient who existed before this feature has one. A client that gets this backwards drags the
  entire existing patient base through the wizard.
- **`step` is where to resume.** The numbers survive here even though the endpoints are named: the client maps number
  to path, and the server never has to.

---

## 3 · Acting as another patient

A care angel signs in as themselves and acts _as_ the patient. Nothing is impersonated — every action is attributed to
the angel.

```
X-Acting-As: <patientId>
```

**Set it in one place — an HTTP interceptor, a middleware, whatever the client's equivalent is — and never at a call
site.** A screen that builds its own request and forgets the header does not fail: it silently reads the wrong
person's record and answers 200. That is the same class of silent-wrong-answer defect as a wrong-hostname nginx block,
and it is why this is a client-wide concern rather than a per-service one.

Three things follow, and each one is load-bearing:

- **`ROLE_ANGEL` grants nothing.** Authority is an `ACTIVE` `CareDelegation`, re-read by `api` on every request. Do
  not gate any screen on the role.
- **The header is a parameter, not a credential.** It selects among scopes the server independently confirms; a
  `patientId` the caller holds no `ACTIVE` delegation for is refused. It is deliberately not a token claim, because a
  token would freeze the delegation and a revoked angel would keep access until it expired — days, with `rememberMe`.
- **The screen must say whose record is open, persistently and unmissably.** This is a safety control, not
  decoration: the failure it prevents is an angel reading a blood group or an allergy list believing it is their own.

### 3.1 · What the client asks at sign-in

```
GET /services/hcpatientservice/api/care-delegations/mine
```

```jsonc
{
  "email": "ophelia@localhost",
  "self": { "patientId": "patient-ophelia", "firstName": "Ophelia", "lastName": "Gaisie", "onboardingStatus": "null" }, // {} when the caller has no record of their own
  "delegations": [
    { "id": "…", "patientId": "patient-kojo", "status": "ACTIVE", "angelEmail": "ophelia@localhost", "patientName": "Kojo Ampia-Addison" }
  ]
}
```

`patientName` is on the row because a delegation otherwise carries only the _angel's_ name, so on its own it cannot
tell somebody whose record they are about to open — and a picker labelled with opaque ids is exactly the confusion the
banner exists to prevent. This endpoint answers for a caller with **no profile at all**, because an angel who is not a
patient is precisely that.

### 3.2 · The four cases, and the fork that traps people

| What comes back                        | What the client does                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `self` and no delegations              | Nothing to choose. The portal, on their own record.                                                       |
| One delegation, no `self`              | Auto-select it. One option is not a decision.                                                             |
| `self` **and** one or more delegations | **Ask.** Do not choose on their behalf, and do not restore a previous choice made by a different account. |
| Neither, but a `PENDING` nomination    | The invitations screen — **not** the wizard.                                                              |
| Neither, and no nomination             | The wizard.                                                                                               |

That fourth row is the one that has already been got wrong once. A nomination sitting at `PENDING` grants nothing, so
it does not read as "acting for somebody"; a naive guard therefore sees no record of the caller's own and sends them
to onboarding, where the inverse guard keeps them. **They end up asked to create a patient record purely to answer
somebody else's nomination.** Any client implementing this journey has the same fork to handle.

Two more, learned from the web client on 2026-08-20 and worth not repeating:

- **Clear the selection on sign-in and on sign-out**, including when a session expires without an explicit sign-out.
  A selection that outlives its session is applied silently to whoever signs in next.
- **Switching records must reload everything scoped to a patient.** The selection changing is not a cosmetic event:
  if the profile lookup keeps resolving the signed-in account, the client shows the angel their _own_ record under the
  patient's name, with the banner cheerfully naming the wrong person.

### 3.3 · The delegation endpoints

```
GET  /api/care-delegations              the delegations over the caller's own record
POST /api/care-delegations/{id}/accept       PENDING → ACTIVE    (the nominee only)
POST /api/care-delegations/{id}/decline      PENDING → DECLINED  (the nominee only)
POST /api/care-delegations/{id}/revoke       → REVOKED           (either party)
POST /api/care-delegations/{id}/activate     STANDBY → AWAITING_COUNTERSIGNATURE   (ROLE_DOCTOR, with a reason)
POST /api/care-delegations/{id}/countersign  AWAITING_COUNTERSIGNATURE → PENDING   (a *different* ROLE_DOCTOR)
```

The last two are the only endpoints a patient never calls and the only ones gated on a role rather than a
relationship. A patient-facing mobile client needs neither.

`POST /api/care-angels` on the **gateway** is what creates or reuses the nominated angel's account. An email that
already has an account gets `ROLE_ANGEL` rather than a second account, and the response says `accountExisted: true`.

---

## 4 · What the client must not do

- **No delete.** Sixteen resources refuse `DELETE` for anyone but `ROLE_ADMIN` — patient and angel alike. Offer no
  delete affordance for patient data. Archiving, the replacement, does not exist yet.
- **No `source` in a payload.** Provenance is stamped from the authenticated caller on create and preserved on
  update. A value a client can choose is a claim, not a record.
- **No re-onboarding**, and no editing `Profile.email`, `careAngelEmail` or `careAngelLogin` while acting as somebody.
  Otherwise an angel could hand their access to a third party or lock the patient's own nominee out.
- **No nominating a further angel** on the patient's behalf.
- **Never restate a plan price.** `GET /api/plans` returns `priceAmount` pre-formatted for the locale. Render it; two
  products quoting different numbers for one tier is what restating causes.

---

## 5 · Where mobile legitimately differs

- **Step 5 can use the camera.** Capturing the identification document from the camera rather than a file picker is
  the one place this client should diverge from the web wizard, and it is an improvement rather than a compromise.
- **Everything else should not diverge.** The endpoints, the resume rule, the acting-as header and the invitations
  fork are the same journey; a second interpretation of them is a second thing to keep correct.

---

## 6 · Decided, 2026-08-21

The three items this section used to leave open are settled, and five more are answered here because they do not
exist on the web and have no default worth inheriting.

**The Angular-baseline question was not just open, it was wrong.** It asked whether to start on Angular 19 or reuse
"the dashboard's Angular 17". The dashboard has been on **20.3.27** since before this file was written; the premise
had rotted. `@ionic/angular@9` peers `@angular/core >=18.0.0`, so matching the web exactly costs nothing and the
trade-off the question described — newer major against shared models — does not arise.

| #   | Decision                                                                                                        |                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Ionic Angular + Capacitor, Angular 20**                                                                       | Ionic owns the shell: tabs, page transitions, back gesture, safe areas, pull-to-refresh, keyboard. The web's `hc-*` CSS owns everything inside a page. |
| 2   | **Portal only**                                                                                                 | The 13 portal screens, acting-as, and sign-in. No onboarding wizard, no invitations screen.                                                            |
| 3   | **Copy the shared TypeScript in, allow divergence**                                                             | Provenance header on every lifted file, `PROVENANCE.md` as the index, `tools/check-provenance.mjs` as the check.                                       |
| 4   | **The acting-as selection clears on cold start, on resume after >15 min backgrounded, on sign-out, and on 401** | Then the §3.2 fork runs again.                                                                                                                         |
| 5   | **Token in the Keychain / Keystore, behind a biometric unlock**                                                 | On cold start and on long resume. `rememberMe` is forced `true` and the checkbox is not rendered.                                                      |
| 6   | **Online-only, but three-state**                                                                                | Every stream is `loading`, `loaded`, or `failed`. No caching in v1.                                                                                    |
| 7   | **Android first**                                                                                               | iOS via `npx cap add ios` once the Android app is real.                                                                                                |
| 8   | **This file is the plan**                                                                                       | Not a new document in `docs/`. One plan file per repo, as `docs/CLAUDE.md` requires.                                                                   |

Three of these deserve their reasoning recorded, because each is a place where the obvious choice is wrong.

**Why Ionic rather than wrapping the existing app (1).** The web shell already has a mobile mode below its 940px
breakpoint — a drawer and the same five-tab bar — so a Capacitor wrapper would have been _pixel_-identical for
almost no work. It was rejected because "the same look, style and feel" is not only pixels: a back gesture that does
nothing, a page transition that is a repaint, and a tab bar that does not keep per-tab history all read as _not an
app_. Ionic buys those, and because all visual truth lives in `_tokens.scss` and `_components.scss` and **nothing
downstream hardcodes a hex**, buying them costs the templates and not the appearance.

**Why portal-only (2), and what it obliges.** The wizard is five endpoints, five payload shapes and the resume rule;
the portal is the reason anyone opens the app twice. Shipping the portal first is the smaller, more useful half. But
**the §3.2 fork must still be implemented in full** — dropping the wizard does not drop the question of where an
unonboarded user goes. Its two terminal branches become dead-end screens that open `patient.abofonsa.com` in the
**system browser**, so the user's password manager and any existing session are available. Those screens must say
_"finish this on the web, then come back"_; a screen that merely refuses is indistinguishable from a bug. §3.2's
fourth row is unchanged and still the trap: a `PENDING` nomination goes to the **invitations** dead end, never the
onboarding one.

**Why the acting-as selection needs a new rule (4).** The web keeps it in `sessionStorage` deliberately — whose
record is on screen must not outlive the session or greet the next person at the device. **A Capacitor webview has
no meaningful session**; it can persist for weeks, across backgrounding and process death, and it survives a
different account signing in. Copying `ActingAsService` verbatim would therefore ship a real defect wearing the
web's safety property as a disguise. On mobile the selection lives **only in the signal**, and the four triggers
above replace the storage rule. One consequence to handle deliberately: an angel holding exactly one delegation is
auto-selected every time (one option is not a decision), so the banner's `role="status"` will not re-announce an
unchanged string — re-announce it explicitly after each fork run.

**`bin/jhipster-ionic` and `.yo-repository/` are discarded.** The generator is JHipster-Ionic 8.2.1 (Angular 18,
Capacitor 6, `ionic-appauth` for OAuth2 — an auth model this stack does not use), installed 2024-06-06 and never
run. It predates every decision in this file. Both paths are now in `.gitignore`, which is also what finally makes
this working tree clean: the 2022 stock template it replaced listed neither.

### Still open, deliberately

- **Dark mode.** Out of scope for v1. Do not import `@ionic/angular/css/palettes/dark.*.css` — half the app would
  invert and the `hc-*` half would not.
- **A read-through cache.** Decision 6 makes a failed fetch _honest_; it does not make a train tunnel pleasant. The
  next step is an in-session memory cache plus a "last updated HH:MM" line. Plan it rather than discovering it.
- **`LONG_ABSENCE_MS`.** 15 minutes is a guess, and biometrics on every resume is aggressive for an app that is
  read-only in v1. It is one exported constant so it can be tuned from data rather than re-argued.
- **Telemetry.** `web/app/core/telemetry/` is not ported. OTel's browser SDK in a webview posting to a
  same-origin `/v1/traces` that no longer exists is a separate design question.

---

## 7 · The port

Source of truth is `web` at `12e418c`. Two files hold all the visual truth — `content/scss/_tokens.scss` and
`content/scss/_components.scss` — and one more holds the icons. That is what makes this port tractable, and it is
the property to protect: **nothing in this app hardcodes a hex either.**

### 7.1 · Shape

```
mobile/
├── patient-mobile.md          this file
├── PROVENANCE.md              path | origin | web sha | divergence
├── capacitor.config.ts  ionic.config.json  angular.json  tsconfig*.json
├── jest.config.js  setup-jest.ts  .eslintrc.json  .prettierrc  .editorconfig
├── tools/merge-i18n.mjs       replaces merge-jsons-webpack-plugin
├── tools/check-provenance.mjs diffs lifted files against a sibling ../web checkout
├── .github/workflows/ci.yml
├── android/                   `npx cap add android`, committed
└── src/
    ├── theme/                 _tokens, _components, _utilities  (verbatim)
    │                          ionic-bridge.scss, mobile.scss    (new)
    ├── i18n/{en,fr,de}/       verbatim
    └── app/
        ├── core/              lifted: config, interceptor, request, util, auth
        ├── core/native/       new: token store, biometrics, lifecycle, lock
        ├── shell/             new: tabs page, banner, picker, more-sheet, nav
        ├── auth/              new: login page, lock page
        ├── fork/              new: session bootstrap — the §3.2 five-case fork
        ├── deadends/          new: onboarding-required, invitations-required
        ├── portal/data/       lifted, except portal-data.service.ts (rewritten)
        ├── portal/<13 pages>/ every template rewritten
        ├── entities/          lifted: 15 × model + service only
        └── shared/ui/         lifted: icon, charts, avatar, empty-state, panel, pager…
```

**Do this before lifting a single file.** In `tsconfig.json`:

```jsonc
"baseUrl": "./",
"paths": { "app/*": ["src/app/*"], "environments/*": ["src/environments/*"] }
```

Every lifted file's `import { … } from 'app/core/auth/account.service'` then resolves with **zero edits**. This one
decision removes most of the mechanical cost of decision 3 and most of the noise from every future re-sync.

### 7.2 · Lifted, rewritten, and never copied

**Lifted near-verbatim** — `core/config/application-config.service.ts` · `core/interceptor/*` (all five and
`index.ts`) · `core/request/request-util.ts` · `core/util/operators.ts` · `core/auth/{account.model,account.service,
user-route-access.service,auth-jwt.service,state-storage.service}` · `config/{authority.constants,input.constants,
dayjs,error.constants,translation.config}` · `portal/data/{portal-format,vitals,status-label.pipe,
care-delegation.service,membership-plan.service}` **and their specs** · `shared/ui/{icon,charts,avatar,empty-state,
panel,pager,search-box,person-filter}` · `shared/language/*` · `login/{login.model,login.service}` ·
`i18n/{en,fr,de}/*.json` · `entities/enumerations/*` · and 15 entities' `<e>.model.ts` + `service/<e>.service.ts`
(`activity-log, address, allergy, care-plan-item, clinical-case, condition, emergency, medication, membership,
professional, profile, report, stat, task, visitation`). The only sweeping change is the selector prefix, `hpd` →
**`hpm`**.

**Rewritten** — every template and page, the shell, and `portal-data.service.ts` (§7.5).

**Never copied** — `shared/shared.module.ts` (it exports `NgbModule` and `FontAwesomeModule`; importing it into a
lifted chart component would drag ng-bootstrap and Font Awesome into the bundle for nothing — write a slim
replacement) · `layouts/*` · `widgets/*` · `dashboard/*` · `home/*` · `admin/*` · `features/*` · `onboarding/*` ·
`invitations/*` · `entities/*/{list,detail,update,delete,route}/` · `core/telemetry/*` · and the dead `resolutions`
block in `web/package.json` still pinning Angular 17.

Every lifted file opens with:

```ts
/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/portal-format.ts @ 12e418c
 * Divergence: none.          // or a one-line summary of every deliberate change
 * Re-sync: see PROVENANCE.md.
 */
```

**Be honest about what this control is worth.** `check-provenance.mjs` needs a sibling `../web` checkout, so CI
cannot run it. It belongs in the release checklist, and a lifted file whose origin has moved is blocking. The
mitigation that would actually work — publishing `portal/data/` and the entity models and services from the web repo
as a private package — is a bigger change than decision 3 contemplates, and is the thing to revisit first if these
two copies start drifting.

### 7.3 · Theming bridge

`theme/ionic-bridge.scss`, imported after `_tokens.scss` and before `_components.scss`, maps the brand onto Ionic's
variables: `--ion-color-primary` ← `$hc-navy` (white contrast, 13.28:1), `--ion-color-secondary` ← `$hc-gold`,
surfaces ← `$hc-bg` / `$hc-card` / `$hc-ink` / `$hc-line`, tab bar ← `$hc-card` with `$hc-navy` selected, and
`--ion-font-family` ← `$hc-sans`.

Generate Ionic's 19 stepped neutrals with a SCSS `@for` mixing `$hc-ink` into `$hc-bg`. That ramp drives placeholder
text, dividers, disabled states and `ion-skeleton-text`; **leaving it on Ionic's default grey is the single most
visible way an app announces itself as unthemed.**

**The gold rule, enforced rather than remembered.** `#c59437` on white is **2.74:1** and fails AA at every size, so
`--ion-color-secondary-contrast` is `$hc-ink` (6.00:1) and **no `ion-button color="secondary"` may carry white
text**. Gold on navy is 4.85:1 — fine at ≥18.66px, so auth accents use `$hc-gold-300` or size up.

Two contrast defects are inherited from the web and get worse at phone pill sizes. Fix them here as a **documented
divergence**, and raise them on the web repo: `$hc-warn #b4741a` on its own background is 3.50 (fails) → `#8f5c14`;
`$hc-ok #2e7d5b` on its own background is 4.39 (marginal) → `#286d4f`. Both keep the hue.

`mobile.scss` carries only what a 390px viewport forces: `.hc-grid` to one column below 600px, `.hc-tbl` scrolling
inside `.hc-tbl-wrap`, less `.hc-hero` padding, `.hc-card` radius from `--hc-r-lg` to `--hc-r`. The `.hc-shell__*`
classes are dropped — the shell is rewritten.

### 7.4 · The banner is a shell element, not a page element

```html
<div class="hpm-shell">
  <hpm-acting-as-banner />
  <!-- ALWAYS rendered, above ion-tabs -->
  <ion-tabs>
    <ion-router-outlet />
    <ion-tab-bar slot="bottom"> …5 buttons… </ion-tab-bar>
  </ion-tabs>
</div>
```

Putting it in each page's `ion-header` is the idiomatic Ionic answer and it is **wrong here**, because it must then
be remembered on 13 pages and one forgotten page shows a patient's record with no banner. That is exactly the
silently-the-wrong-person failure §3 calls a safety control, and it is the same argument that puts `X-Acting-As` in
one interceptor: make forgetting impossible rather than unlikely.

Four consequences follow:

1. **The banner now owns the top inset.** It takes `padding-top: var(--ion-safe-area-top)`, and `--ion-safe-area-top`
   is set to `0px` **scoped to `ion-tabs`** — not globally, because login and lock sit outside the shell and still
   need it. Otherwise the inset doubles. Only visible on a real notched device.
2. **Two states, always rendered** — `actingAs.bannerOwn` when the choice is the user's own _and_ a switch is
   possible, `actingAs.banner` naming the patient otherwise. This is the web's own regression fix; `.hc-shell__acting-as`
   and `.is-own` port straight across.
3. **Switching is the web's `switchRecord()` plus one mobile-only step.** Guard against re-selecting the same id,
   `actingAs.select(id)`, **`data.reload()`**, navigate to overview — and then **pop every tab stack to its root**.
   Without that last step a case detail belonging to the previous patient survives on a background stack and
   reappears on the next tab tap. The web has no equivalent of this bug.
4. **`mustChoose` is an `ion-modal`** with `[canDismiss]="false"` and `[backdropDismiss]="false"`, and the Android
   hardware back button must not dismiss it either.

### 7.5 · Three states, not one

Every one of the 12 portal streams currently ends `catchError(() => of([]))`, so a failed fetch and an empty
collection are the same value. On a phone that renders as **"No allergies recorded"** when the truth is that the
request never arrived — and an allergy list is the worst possible place for those two to read alike.

```ts
export type Resource<T> = { state: 'loading' } | { state: 'loaded'; value: T } | { state: 'failed'; status: number | null; error: unknown };
```

`PatientContextService` goes first, because everything depends on it. `profile$` becomes `profileState$` with
`blankOnlyOn404` **untouched**: a 404 becomes `loaded(null)` — "you have no profile" is a real state — and anything
else becomes `failed`. **Do not widen that narrowing while wrapping it.** It is the guard that stops a network blip
throwing a fully onboarded patient at the onboarding dead end, which in v1 is a screen they cannot get past.
`careTeam$` has the same defect and gets the same treatment.

`PortalDataService` is rewritten around one private `scoped<T>(key, service)` helper that passes `loading` and
`failed` through from the profile state, returns `loaded([])` when there is no patient id (no record is not a
failure), keeps the **double filter** — server query parameter _and_ client-side `patientId` check, defence in depth,
unchanged — and places `startWith(LOADING)` **inside the `switchMap`, after `catchError`**.

That placement earns its keep twice. It guarantees the sequence is always `loading → (loaded | failed)`. And because
it is inside the `switchMap`, **an acting-as switch resets all 12 streams to `loading`** — which fixes a live defect:
today `shareReplay({ refCount: false })` keeps the previous patient's rows on screen under the new patient's name
for the duration of a request. Write the spec for exactly that.

One `hpm-stream` component renders all three states so the 12 streams cannot drift apart: skeleton rows sized to the
real row, the existing `hpm-empty-state`, or a card with a message keyed off status (`0`/`null` → no connection,
`403` → no access to this record, else generic) and a **Try again** button. Never surface a raw error string.

Anything `computed()` across streams must decide explicitly what a failure means for it. The overview's "3 of your
12 cases are active" must not render while `cases$` is `failed`, because **"0 active" would be a lie**. Same for the
emergencies badge: nothing on loading or failed, never `0`.

### 7.6 · Token, biometrics, lifecycle

Plugins sit behind interfaces in `core/native/` so that no app code imports one directly and either can be swapped:
`@capacitor/{app,preferences,browser,keyboard,status-bar,splash-screen}`,
`@aparajita/capacitor-secure-storage@8`, `@aparajita/capacitor-biometric-auth@10`. All peer Capacitor 8.

**The synchronous-token problem.** `StateStorageService.getAuthenticationToken()` is synchronous and `AuthInterceptor`
calls it on every request; secure storage is async. Do not make the interceptor async — that is a keychain read per
HTTP call and it turns every interceptor spec async. Instead `core/native/session-token.service.ts` holds the token
in an in-memory signal with a synchronous `get()`, and async `unlock()` / `persist()` / `lock()` / `signOut()` around
the secure store. `StateStorageService` keeps its shape and delegates, so `AuthInterceptor` and `AuthServerProvider`
port verbatim. `previousUrl` and `locale` move to Preferences.

`AppLifecycleService` exposes one signal, `resumed$: 'cold-start' | 'long-resume'`, from `App.addListener(
'appStateChange')` plus a `backgroundedAt` persisted to Preferences so that a process kill still yields a sane
answer on relaunch.

**`suppressNextResume()` must wrap every native prompt.** The biometric dialog, the camera, the file picker and the
system browser all background the app on Android, so a naive listener re-locks in a loop the moment it locks. There
is a `native/with-prompt.ts` for this and it is not optional. **This is the most likely bug in this area.**

Order is load-bearing — the fork calls `/care-delegations/mine`, which needs a token, which needs the unlock:

```
resumed$ → AppLockService.lock()      // clear in-memory token, actingAs.clear(), → /lock, pop stacks
              └─ unlock ok → SessionBootstrapService.restart() → the §3.2 fork
```

`LockPage` prompts inside `withPrompt` with `allowDeviceCredential: true`; failure offers **Unlock** and **Use
password**. **If the device has no screen lock at all, refuse to persist the token** — sign out, require a password
every launch, and say so in the copy. Do not silently keep a 7-day token on an unsecured device, particularly given
that the gateway has no revocation.

Two device traps: **the iOS Keychain survives app uninstall**, so use `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
and clear the store on first run, detected with a Preferences flag (which does not survive uninstall). And the wall
clock can move — a process kill always yields `cold-start` regardless, so the worst case is a resume that should
have locked and did not. Acceptable; do not chase a monotonic clock across process death.

### 7.7 · Build

`@angular/build:application` (esbuild), **no custom webpack**. Three consequences:

1. `tools/merge-i18n.mjs` replaces `merge-jsons-webpack-plugin` and writes the content hash `translation.config.ts`
   reads. Make it **fail the build when the three locales have unequal key sets** — they are 1199 / 1198 / 1189
   today, and a missing key renders `translation-not-found[key]` in that language with nothing failing. Close the
   gap in the scaffold phase while the diff is small. This is a check the web does not have.
2. `DefinePlugin` globals become `src/environments/*` with `fileReplacements`.
3. **`SERVER_API_URL` must be absolute**, because a Capacitor webview is `https://localhost` and nothing is
   same-origin. Set `androidScheme: 'https'` and `CapacitorHttp: { enabled: true }` so XHR is patched to the native
   client and **CORS does not apply** — the gateway has CORS deliberately disabled and would refuse every preflight.
   `setEndpointPrefix()` runs in an `APP_INITIALIZER` that **must resolve before any HTTP call**: both interceptors
   compare `request.url` against `getEndpointFor('')` to decide whether to attach headers, so with an empty prefix
   they attach to every host, including third-party ones. Spec it.

Jest mirrors `web/jest.conf.js` with `transformIgnorePatterns` exempting `@ionic|@stencil|ionicons|@capacitor|
dayjs/esm` — the same ESM failure class the web hit with d3, different packages. Mock the plugins in
`setup-jest.ts`; `Capacitor.isNativePlatform()` is `false` under Jest, which selects the web token store — make that
explicit rather than incidental.

ESLint is the web's config with prefix `hpm`, keeping the `member-ordering` block **and its comment** — private
instance fields before public, because `inject()` runs in field-initialiser order and every lifted service depends
on it. **No `pretest: lint` hook**: that is why `npm test` on web has been failing on lint for months and everyone
uses `npx ng test` instead. Gate them separately in CI.

**Prettier does not format `*.html`, and that is a decision — recorded 2026-09-08, backlog item 16.** Every Prettier
release from 2.8.8 to 4.0.0-alpha.13 flattens the contents of an `@if`/`@for` block to the parent's indentation; the
12 templates here are indented by hand because that is the readable form. So the `prettier:check` and
`prettier:format` globs drop `html`, `.prettierignore` drops it again for a bare `prettier --check .`, and the
templates keep their own shape. **There is no newer version to bump to** — that was the first thing checked, and the
count of disagreeing templates is 12 at every version.

**`core/i18n-templates.spec.ts` reads the templates against the bundles — backlog item 22, 2026-09-09.** The two
i18n checks that existed before it both compare bundles: `merge-i18n.mjs` fails on unequal key sets, and
`core/i18n-keys.spec.ts` resolves every key the app names. **Neither can see a string that never became a key**,
which is how `lock.page.html` came to import `TranslateModule` and use it zero times, and `tabs.page.html` to
translate an `aria-label` two lines above an untranslated `<ion-label>`. This spec parses every template with
Angular's own `parseTemplate` — the `.html` files **and** the 12 inline `template:` strings in `shared/ui`, because
item 21's lesson is that a check scoped to one form silently exempts the other — and fails on a text node that is
not a translation. Three things make it trustworthy rather than merely present:

- it understands `hpmTranslate`, which assigns to `innerHTML`, so the English placeholder inside such an element is
  not reported. That is 72 of the app's 99 text nodes; without it the check reports 65 defects that are not defects
  and gets switched off within a week;
- the allowlist is nine entries, each with a reason — a brand wordmark, a middot between two bound values, `%` after
  a number, the punctuation inside four SVG chart tooltips, and the pager's two guillemets — and it is asserted
  **exact**, so it cannot rot into a suppression list;
- it **guards the guard**. Counts of templates found, inline templates found, text nodes examined, nodes exempted by
  the directive and nodes actually judged all carry floors, because the main assertion is `expect([]).toEqual([])`
  and passes vacuously the moment the walker stops walking. Verified by mutation: breaking file discovery and
  over-matching the directive each leave the main test green and are caught only here.

The strings it moved were the lock screen, the fork-failure screen, both dead ends, the record picker, the More tab
and the sign-in note — plus, in the same pass, the copy those screens render **from TypeScript**, which no template
walker can see: `dead-end.page.ts`, `fork-failed.page.ts` and `lock.page.ts` now return translation KEYS, and the
two strings the OS draws (`BiometricsService`'s biometric prompt) and the four the exit confirm draws
(`BackButtonService`) are translated through `TranslateService.instant`. A controller-built alert and an OS dialog
are outside every template check there can be; they are the residual risk here and are worth a second look in review.

**What that costs is formatting and nothing else — but only since backlog item 21, 2026-09-08.** Until
then it cost correctness too, and the section you are reading got that wrong twice. Its first draft
claimed template correctness was gated by `@angular-eslint/eslint-plugin-template` under `npm run lint`
when the plugin and `@angular-eslint/template-parser` were in `devDependencies` and wired to nothing:
the plugin absent from `plugins`, no override setting the template parser for `*.html`, and `lint`
running `eslint . --ext .js,.mjs,.ts`, which never opens a template. Forcing it proved the point —
`npx eslint src/app/portal/allergies/allergies.page.html` answered _"The extension for the file
(`.html`) is non-standard."_ The correction then over-swung and said the templates were checked by the
AOT compiler and nothing else, which item 21 made false in turn.

**Item 21 wired it up rather than removing the packages**, because the a11y rules alone justify the
gate in an app read by patients. The shape:

- `.eslintrc.json` gained an `"files": ["*.html"]` override extending `template/recommended` and
  `template/accessibility`. Wiring it meant moving the script configuration — `parser`, `plugins`,
  `extends`, `parserOptions` and `rules` — from the file's top level into a `["*.js","*.mjs","*.ts"]`
  override, because a top-level `parserOptions.project` applies to every file eslint opens and a
  `.html` handed to `@typescript-eslint`'s type-aware rules fails on missing parser services. The
  move is nesting only: `eslint --print-config` is byte-identical before and after for a page, a
  spec, a tool script and `jest.config.js`.
- `npm run lint` is now `eslint . --ext .js,.mjs,.ts,.html`, and CI's existing `npm run lint` step
  therefore covers templates with no new step.
- **Measured before any rule was set:** the two extended configs found **10 problems in 5 files**
  (`click-events-have-key-events` ×5, `interactive-supports-focus` ×5) across the 30 `.html` templates — plus, since review, the twelve
  `shared/ui` components whose markup is inline and which the `*.html` override alone did not reach;
  the whole
  plugin (`template/all`, 29 rules) found **673**, from 9 of them. All 10 were fixed in the markup.
  There is no `eslint-disable` in any template.
- The fixes were one shape: four inline `<a (click)="openCase(…)">` case links with no `href`, so
  nothing made them focusable and nothing activated them from a keyboard, and the **archived** case
  card in `cases.page.html`, which had none of the `role`/`tabindex`/`(keydown.enter)` contract the
  working card six lines above it already carried. That last one is the item's argument in one file.
- **Nineteen of the 29 rules are at error**; the other ten are off, each named in `.eslintrc.json`
  with a one-line reason and the count still behind it — 364 `i18n` (an extraction pipeline this app
  does not use), 161 `no-call-expression`, 60 `attributes-order`, 41 `prefer-self-closing-tags`,
  22 `no-duplicate-attributes` (all of them `class="…" [class]="…"`, which Angular merges), 8 `no-any`,
  8 `no-inline-styles`, and three at zero. The list lives in the config so it cannot drift from what
  the config does.
- **Do not read that 364 as noise.** The rule is correctly off and its reason no longer asserts there
  is nothing behind the number: about 280 of the hits are attributes and genuinely are noise here, but
  ~84 are text nodes, and among them were real untranslated English strings in an app shipping three
  locales. That is backlog item 22, closed 2026-09-09 — see §7.7.

Dropping `*.html` from prettier in item 16 removed a _whitespace_ check that was never passing anyway,
and did not cause any of the above.

Everything else Prettier is pointed at **is** formatted to the pinned 3.1.0 and **checked in CI**, which is the half
that matters: 61 files disagreed with the pin for months because nothing ran `prettier:check` — no CI step, no
`lint-staged`, no `.husky/`. A pin nothing enforces is not a pin. The version itself is now arbitrary; 3.1.0 is kept
only because `web` and `api` pin it too (`gateway` is on 3.2.5, and nobody has written down why).

CI is one workflow on push and PR to `master`: a node job (`npm ci`, lint, `test:ci`, `build:prod`) and an Android
job needing it (temurin **21**, `cap sync android`, `./gradlew assembleDebug`, upload the APK). Do **not** copy the
web repo's `docker-publish.yml` (failing since 2026-07-30 against a Dockerfile in another repo) or `release.yml`
(publishes an nginx image this app does not have).

**The JDK trap applies here through Gradle.** `/usr/lib/jvm/java-25-openjdk-amd64` is a JRE with no `javac`, and the
`java` on `PATH` is Oracle 25, which _does_ have one — so `java -version` will not catch it. Gradle's failure reads
`does not provide the required capabilities: [JAVA_COMPILER]`, and a warm build **still installs a stale APK**,
which is the part that wastes an afternoon. Pin `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64` and
`ANDROID_HOME=$HOME/Android/Sdk` in the README and in CI.

### 7.8 · Phases

Each is PR-sized and ends in something testable by hand.

|       | Work                                                                                                                                         | Done when                                                                                                                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | Docs and hygiene: this file, `PROVENANCE.md`, the new `.gitignore`, the stale lines in `docs/CLAUDE.md`.                                     | `git status` clean on `master` for the first time.                                                                                                                                            |
| **1** | Scaffold and theme: `ionic start`, tsconfig paths, lint/prettier/jest, `theme/`, `merge-i18n.mjs`, `capacitor.config.ts`, `cap add android`. | One page shows an `ion-button color="primary"` beside an `.hc-card` with the right radius and shadow — **on a device**. i18n key-equality green.                                              |
| **2** | Core, auth, sign-in: lift `core/*`, write the token store, `LoginPage`, the `APP_INITIALIZER`, i18n in.                                      | Sign in on a physical Android device against the quality stack; token in EncryptedSharedPreferences; kill and relaunch still signed in; **no `Authorization` header on `/api/authenticate`**. |
| **3** | The fork, acting-as, dead ends.                                                                                                              | The five accounts, five outcomes table in §8.3, by hand.                                                                                                                                      |
| **4** | Data layer: 15 models and services, `profileState$`, `PortalDataService`, `hpm-stream`.                                                      | Airplane mode shows failed-with-retry on every panel, **not** empty. Switching records flashes skeletons, never the previous patient's rows.                                                  |
| **5** | The 13 screens, in the §8.1 order.                                                                                                           | Each ships with loading/empty/failed specs, an `ion-refresher`, a More-sheet entry, and a side-by-side walk against the web. 13 PRs.                                                          |
| **6** | Lifecycle and lock.                                                                                                                          | Background past the threshold → biometric → unlock → picker returns. Cancel the prompt → **no lock loop**. Revoke a delegation server-side → 401 → login, selection cleared.                  |
| **7** | Polish and release: deep links, back-button policy, keyboard, safe areas on a notched device, splash and icon, cleartext off, signed build.  | `assembleRelease` produces an installable signed artifact; CI green on a PR.                                                                                                                  |
| **8** | iOS.                                                                                                                                         | `cap add ios`, Keychain accessibility flags, `NSFaceIDUsageDescription`, and the same five fork outcomes.                                                                                     |

---

## 8 · The screens

### 8.1 · Thirteen routes, five tabs

`shell/mobile-nav.ts` replaces the web's `shell-nav.ts`, keeping the same five `MOBILE_TABS`, the same ten
`MOBILE_NAV` items in the same order with the same i18n keys, and extending `NAV_OWNER` into `TAB_OWNER`:

| Tab       | Root        | Also on this stack                     |
| --------- | ----------- | -------------------------------------- |
| Overview  | `overview`  | `emergencies`                          |
| Record    | `record`    | `visitations`, `activity`, `allergies` |
| Schedules | `schedules` | —                                      |
| Cases     | `cases`     | `medications`, `reports`, `plans`      |
| Profile   | `profile`   | —                                      |

The grouping is the web's own sidebar grouping — health, clinical, account — rather than a fresh opinion.
`allergies` is the one judgement call: it goes under `record` because on a phone it reads as record content, and
because **no screen links to it** (it is sidebar-only on the web), so it needs an explicit home or it has none.

**`case/:id` is registered under all five tabs** via a `caseRoute()` factory. It is linked from eight screens.
Jumping tabs to open a case would yank the reader out of the list they were scanning; registering it once above the
tab bar would hide the tab bar on the most-visited detail screen in the app. Five copies of one lazy route object is
the cheap answer.

**No template hardcodes a `/tabs/...` URL.** `shell/portal-nav.service.ts` resolves `go('medications')` to
`/tabs/cases/medications` by reading `TAB_OWNER`, so moving a screen between tabs is a one-line change.

**Five tabs cannot reach ten destinations.** Every tab root carries a `⋯` button opening `MoreSheetComponent`, an
`ion-modal` listing all ten `MOBILE_NAV` items with their icons, badges and group headings, driven off the same
constant the tab bar reads. This is the sidebar's job on a phone, and it is what stops a repeat of the web defect
where two screens sat routed with no way into them for months.

### 8.2 · Routes outside the shell

```
''                      → redirect /tabs/overview
'login'                 LoginPage                 no shell
'lock'                  LockPage                  no shell, canDismiss:false
'onboarding-required'   dead end                  guarded, no shell
'invitations-required'  dead end                  guarded, no shell
'tabs'                  TabsPage                  canActivate: [UserRouteAccessService, forkGuard]
```

`AuthShellComponent` has no mobile analogue — its split brand-left/form-right layout is a desktop idea. `LoginPage`
is a single full-bleed `ion-content` reusing the `.hc-auth*` classes.

### 8.3 · The fork, and how it is verified

`SessionBootstrapService` implements §3.2 in one place, and these five accounts are the acceptance test — run by
hand on a device in phase 3, again in phase 6:

| Account                         | Expected                                                         |
| ------------------------------- | ---------------------------------------------------------------- |
| self, no delegations            | straight in; banner in its `is-own` state, switcher hidden       |
| angel only, one delegation      | auto-selected; banner names the patient                          |
| self **and** a delegation       | **asked**; modal undismissable; hardware back does not escape it |
| fresh registration, no record   | onboarding dead end, opening the web in the **system browser**   |
| `PENDING` nomination, no record | invitations dead end — **not** the onboarding one                |

One divergence from the web to record deliberately: when `/care-delegations/mine` **fails**, the web falls back to
`setAvailable([])`, which is right for a desktop portal already showing the signed-in person. On mobile, combined
with the cold-start reset, that turns a transient failure into an angel-only user staring at an empty portal under
their own name. A failed fork gets an explicit retry screen instead.

### 8.4 · Traps carried across

Most of these are already in §1–§5 or in `web/patient-web.md`; they are gathered here because a rewrite is exactly
when they come back.

1. **`X-Acting-As` is set by the interceptor and by nothing else** — and the mobile twist is worse than the web's.
   With `CapacitorHttp` enabled, a raw `fetch()`, an `<img src="…/api/…">` or `Browser.open(apiUrl)` bypasses
   Angular's interceptor chain entirely: **no `Authorization`, no `X-Acting-As`**, and a 200 carrying the wrong
   patient's record. Add an eslint `no-restricted-globals` rule for `fetch` outside `core/`. The web already hit the
   auth half of this — "Open file" was a plain `<a href>` and returned a 401 page for every uploaded report.
2. **`Profile.address` is a document.** Interpolating it prints `[object Object]`; `formatAddress` in
   `portal/data/portal-format.ts` is the only way to render it.
3. **Instants are not calendar dates.** `formatDay` never shifts; the others render in the record's zone via
   `.utc()`. Ghana is UTC year-round, so a phone in another timezone exposes this in a way the browser never did — a
   23:05 alert becomes 01:05 **the next day**, the wrong day on a clinical record. Lift `portal-format.ts` _and its
   spec_; on the web only the test caught this.
4. **Read `onboarded`, never re-derive it from `status`** (§2.3). Getting it backwards sends every pre-existing
   patient to a dead end they cannot leave.
5. **No delete affordance anywhere** (§4). The mobile reflex is `ion-item-sliding` with a red Delete — ban it.
6. **Never restate a plan price** (§4). Render `priceAmount`; no `CurrencyPipe`, no arithmetic, no "from ₵X".
7. **`ROLE_ANGEL` grants nothing** (§3). Do not gate a screen, a tab or a nav item on it.
8. **Android hardware back** must not dismiss `mustChoose`, must pop within the tab's own stack, and must not exit
   the app from a tab root without a confirm.
9. ~~**The gateway and api still ship different JWT secrets** in committed config.~~ **No longer true, and this
   trap was already stale when it was written here.** Both repos have shipped the SAME committed dev key since
   2026-08-05, both use `${JWT_BASE64_SECRET:}` with no default in prod, and both `.yo-rc.json` files carry an
   empty `jwtSecretKey`. Every compose file — quality, local and production — injects one variable into BOTH
   services. Verified 2026-08-21 by comparing the values rather than the comments.

   The symptom is still worth knowing, because something else can produce it: if sign-in succeeds and every
   `/services/hcpatientservice/**` call 401s, compare
   `JHIPSTER_SECURITY_AUTHENTICATION_JWT_BASE64_SECRET` across the two containers — a partial injection (one
   service given an override the other was not) would look identical from the client, and is not a client bug.
