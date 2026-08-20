# hc-patient-app — plan of record

**Status: no code.** This repository holds a `.gitignore`, an untracked `bin/jhipster-ionic` and nothing else. This
file is Phase D of `docs/onboarding.md`: it freezes the contract the Ionic client will be written against, so that the
app can be started without re-reading three backends.

The contract below is taken from **`docs/onboarding.md` §16, not from its §4–§10.** Those earlier sections describe
what was *planned*; §16 records what was *built*, and the two differ in ways that matter to a client — the step
endpoints are named rather than numbered, the status response carries `onboarded`, and `/mine` returns the patient's
name. Where this file and the code disagree, **the code is right and this file is the bug**; it was written on
2026-08-20 against `api` `cec2c24` and `gateway` `b2314cf`.

---

## 1 · Which service owns what

There is no transaction anywhere in this journey, and no service that owns it end to end. **The client is the
orchestrator**, and that is a deliberate consequence of the two backends being separate and Mongo running standalone.

| Concern | Service | Why it cannot be the other one |
| ------- | ------- | ------------------------------ |
| Registration, activation, password reset, JWT | `gateway` | It is the only service with a `User` domain. `api` runs `skipUserManagement: true`. |
| Creating a care angel's account | `gateway` (`POST /api/care-angels`) | Same reason — creating a user is something no other service can do. |
| Sending any mail | `gateway` | `api` has the mail dependency in its pom and no `MailService`. |
| The clinical record, onboarding, delegation | `api` | It owns the domain, and `PatientScope` is the whole authorization model. |
| Membership plans | `gateway` proxy to Abofonsa (`GET /api/plans`) | A deliberate exception to discovery-based routing. |

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
only be typed as a map or as a wrapper of five optional blocks — both of which make the contract *harder* to implement
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

**The `noConditions` / `noAllergies` / `noMedications` flags are boxed booleans and null means *unanswered*** — which
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

A care angel signs in as themselves and acts *as* the patient. Nothing is impersonated — every action is attributed to
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
{ "email": "ophelia@localhost",
  "self": { "patientId": "patient-ophelia", "firstName": "Ophelia", "lastName": "Gaisie",
            "onboardingStatus": "null" },          // {} when the caller has no record of their own
  "delegations": [ { "id": "…", "patientId": "patient-kojo", "status": "ACTIVE",
                     "angelEmail": "ophelia@localhost", "patientName": "Kojo Ampia-Addison" } ] }
```

`patientName` is on the row because a delegation otherwise carries only the *angel's* name, so on its own it cannot
tell somebody whose record they are about to open — and a picker labelled with opaque ids is exactly the confusion the
banner exists to prevent. This endpoint answers for a caller with **no profile at all**, because an angel who is not a
patient is precisely that.

### 3.2 · The four cases, and the fork that traps people

| What comes back | What the client does |
| --------------- | -------------------- |
| `self` and no delegations | Nothing to choose. The portal, on their own record. |
| One delegation, no `self` | Auto-select it. One option is not a decision. |
| `self` **and** one or more delegations | **Ask.** Do not choose on their behalf, and do not restore a previous choice made by a different account. |
| Neither, but a `PENDING` nomination | The invitations screen — **not** the wizard. |
| Neither, and no nomination | The wizard. |

That fourth row is the one that has already been got wrong once. A nomination sitting at `PENDING` grants nothing, so
it does not read as "acting for somebody"; a naive guard therefore sees no record of the caller's own and sends them
to onboarding, where the inverse guard keeps them. **They end up asked to create a patient record purely to answer
somebody else's nomination.** Any client implementing this journey has the same fork to handle.

Two more, learned from the web client on 2026-08-20 and worth not repeating:

- **Clear the selection on sign-in and on sign-out**, including when a session expires without an explicit sign-out.
  A selection that outlives its session is applied silently to whoever signs in next.
- **Switching records must reload everything scoped to a patient.** The selection changing is not a cosmetic event:
  if the profile lookup keeps resolving the signed-in account, the client shows the angel their *own* record under the
  patient's name, with the banner cheerfully naming the wrong person.

### 3.3 · The delegation endpoints

```
GET  /api/care-delegations              the delegations over the caller's own record
POST /api/care-delegations/{id}/accept       PENDING → ACTIVE    (the nominee only)
POST /api/care-delegations/{id}/decline      PENDING → DECLINED  (the nominee only)
POST /api/care-delegations/{id}/revoke       → REVOKED           (either party)
POST /api/care-delegations/{id}/activate     STANDBY → AWAITING_COUNTERSIGNATURE   (ROLE_PROFESSIONAL, with a reason)
POST /api/care-delegations/{id}/countersign  AWAITING_COUNTERSIGNATURE → PENDING   (a *different* ROLE_PROFESSIONAL)
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

## 6 · Open, and to be decided before the first commit

- **Angular baseline.** Ionic on Angular 19, or reuse the dashboard's Angular 17 to share models and services? This
  has been open since the workspace consolidation and nothing here settles it. Sharing models argues for 17; starting
  a new app in 2026 on a superseded major argues for 19.
- **Whether the app ships the wizard at all**, or only the portal, leaving onboarding to the web. The contract above
  supports either; the decision is a product one.
- **`bin/jhipster-ionic`** is untracked scaffolding from 2022 and predates every decision in this file. Treat it as
  archaeology, not as a starting point.
