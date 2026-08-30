# Mobile ↔ web parity

What `hc-patient-app` does and does not do, measured against `hc-patient-dashboard`.

- **Swept:** 2026-08-23, mobile at `d19ca07`, web at `da78e9a`.
- **Port point:** the app was lifted from web at `12e418c` (`PROVENANCE.md`), so "drift since the
  port" below is literally `git diff 12e418c..HEAD` over `web/src/main/webapp/app`.
- **Companion docs:** `patient-mobile.md` is the plan of record — §7.8 owns the phase criteria and
  §4/§5 own what mobile deliberately does differently. This file records the _result_ of comparing
  the two apps, not what was planned.

Status legend: `[x]` at parity · `[~]` deliberate divergence · `[ ]` gap.

> **All four gaps below were closed on 2026-08-23.** The sweep's _prose_ is left as it was written,
> because it is a dated record of what the two apps looked like and the reasoning is worth keeping.
> The _markers_ are not: each of the four now reads `[x]` and names what closed it, because a reader
> landing on one entry does not see this banner. **[Decisions](#decisions--2026-08-23) at the end of
> this file is what is true now**, and two of the four went against what the sweep argued for.
>
> Marker corrected 2026-08-30. Until then the four headings still read `[ ]`, which had already been
> believed once in another repository: `docs/android-publishing-steps.md` cited "no registration, no
> password reset" as a live gap two days after the screens shipped.

## The short version

Parity is closer than the difference in size suggests. Every one of the thirteen portal screens
exists on both, the data layer is the same shape, the four chart components are the same four, the
write paths are the same three, and the i18n key sets differ by exactly the seventeen keys of a
screen mobile does not have.

**One real gap, and it is the same defect the web had until 2026-08-22:** an administrator signing in
lands on a dead end. Everything else below is either a documented decision or a shared gap the two
apps have equally.

## Gaps

### `[x]` An administrator signing in reaches a dead end

**Closed 2026-08-23** — [the finder is ported](#the-finder-is-ported-and-an-administrator-gets-it-on-the-phone),
against what this entry argued for. The fork answers `finder` for `ROLE_ADMIN`.

`fork.guard.ts` / `session-bootstrap.service.ts` has no `ROLE_ADMIN` branch. An administrator has no
`Profile` and never will, so the fork resolves: no acting-as choices → no nominations → `kind:
'onboarding-required'` → `deadends/dead-end.page.ts`, which offers _"Set up on the web"_ and _"Sign
out"_ and nothing else.

This is the same question `onboardingGuard` got wrong on the web, fixed there in
`hc-patient-dashboard#26`. The consequences differ:

- On the web it was worse than it looked, because `/admin` and `/entities` hang off the same
  shell-parent — an administrator was redirected out of the administrative screens themselves.
- Here there are no administrative screens to lose. `admin/*` is on `patient-mobile.md`'s
  never-copied list, so the honest question is not "where should an administrator land" but
  **"should an administrator be able to sign in at all"**, and the app currently answers by letting
  them authenticate and then stranding them.

The plan does not address administrators anywhere. Two defensible answers — refuse at sign-in with a
message naming the web console, or route them somewhere that admits they have no record here — and
picking between them is a product decision, not a defect fix.

### `[x]` No account surfaces: no registration, no password reset

**Closed 2026-08-23** — [both landed](#registration-and-password-reset-both-land-on-mobile). `app.routes.ts`
routes `register`, `reset-password` and `reset-password/finish`, and the interceptor entries below stopped
being plumbing without a purpose. This is the entry `docs/android-publishing-steps.md` read as still open.

`auth.interceptor.ts` already allowlists `api/register`, `api/account/reset-password/init` and
`api/account/reset-password/finish` as unauthenticated paths — the plumbing anticipates screens that
do not exist. A person who has not got an account, or who has forgotten their password, cannot start
or recover from the phone; they have to reach the web app.

`patient-mobile.md` never lists `account/*` among the never-copied directories, unlike `admin/*` and
`layouts/*`, so this reads as unfinished rather than decided. It may well be the right scope for v1 —
but the interceptor entries are a standing hint that somebody expected otherwise.

### `[x]` Nothing surfaces archived clinical cases

**Closed 2026-08-23** — [shown collapsed on both apps](#archived-cases-appear-on-both-apps-collapsed),
with the date and the archivist. Whether to render `archiveReason` stays open.

`hc-patient-service` gained archiving on 2026-08-22. Neither app is wrong today: `GET
/api/clinical-cases` excludes archived cases by default, so both quietly stopped showing them with no
client change. But neither can _show_ an archived case deliberately (`?includeArchived=true`) nor
explain why a case a patient remembers is no longer listed. Shared with web; recorded here because
the mobile case list is the screen most likely to be asked about.

## Deliberate divergences

### `[~]` No patient finder, and no administrator portal

`portal/patient-finder/` is web-only (added 2026-08-22). It exists because an administrator on the
web has no record of their own and lands on an empty overview; the finder searches the directory and
opens somebody's record through `ActingAsService.open()`. Mobile has no equivalent and should not
grow one casually — it is an administrative surface on a patient's phone.

This is also why `ActingAsService` has diverged: web's gained an _adopted_ choice persisted whole in
`sessionStorage`, mobile's persists nothing at all (§6 decision 4). The web's persistence bug — a
selection restored by id naming a choice the refetched delegation list cannot contain — **cannot
occur here**, because there is nothing to restore.

### `[~]` Seventeen i18n keys behind, all of them the finder's

410 `patientPortal` keys on web, 398 on mobile. The difference is exactly `finder.*` (17 keys web
has) against `stream.*` and `empty.title` (5 keys mobile has, for the three-state streams §7.5 added).
All three mobile locales carry an identical key set — 1204 keys each, verified.

### `[~]` No telemetry

`core/telemetry/*` is on the never-copied list and §6 records why: OTel's browser SDK inside a webview
posting to a same-origin `/v1/traces` that does not exist there is a separate design question. So a
mobile failure is invisible to Grafana in a way a web failure is not — worth knowing before treating
the absence of mobile traces as the absence of mobile problems.

### `[~]` No `layouts/`, `widgets/`, `dashboard/`, `home/`, `features/`, generated entity CRUD

All on `patient-mobile.md`'s never-copied list, all for stated reasons. Note `widgets/*` is not a
loss of charts: the four the portal actually uses — sparkline, trend, stack-bar, bar-chart — were
rewritten under `shared/ui/charts/` and are present. `features/*` are the web's modal wrappers, whose
function is covered by the portal screens themselves.

## Shared gaps — the two apps have these equally

### `[x]` `visitations` and `activity` are routed but not in the navigation

**Closed 2026-08-23** — [added to both apps](#visitations-and-activity-join-the-navigation). Ten nav
entries became twelve, which also closed `patient-web.md` Phase E B1.

Both apps route all thirteen screens and list ten in the navigation. `shell-nav.ts` on the web and
`mobile-nav.ts` here both omit visitations and activity, so both are reachable only by a link from
another screen. Tracked on the web as `patient-web.md` Phase E B1; the same omission was carried over
rather than introduced.

## At parity — checked, not assumed

- `[x]` **All thirteen portal screens**: overview, record, cases, case detail, schedules, emergencies,
  medications, reports, plans, allergies, visitations, activity, profile.
- `[x]` **The data layer**: `patient-context.service`, `portal-data.service`, `portal-format`,
  `vitals`, `status-label.pipe`, `care-delegation.service`, `membership-plan.service`,
  `report-upload.service`. Mobile adds `resource.ts` for the three-state streams.
- `[x]` **`blankOnlyOn404`** — `PatientContextService` narrows its `catchError` to 404 only, and the
  lifted file marks it UNCHANGED. Widening it would throw a fully onboarded patient at a dead end on
  a network blip, which is the failure the web narrowed it to prevent.
- `[x]` **The write paths**, all three and no more: report upload, a note from case detail, a care
  angel nomination from profile. Neither app writes anything else, and neither offers a delete
  affordance — generated entity services carry `delete()`, no screen calls it, and the api refuses it
  for anyone but `ROLE_ADMIN`.
- `[x]` **The §3.2 fork's fourth row**: somebody holding only a `PENDING` nomination goes to their
  invitations, not to onboarding. Mobile reads the _raw_ delegation list for this rather than
  `toActingAsChoices`, which counts only `ACTIVE` — the distinction the web got wrong once.
- `[x]` **Charts**: the same four components.
- `[x]` **Three locales**, key-identical.

## Drift since the port, in full

`git diff 12e418c..da78e9a -- src/main/webapp/app src/main/webapp/i18n` on the web is 19 files. Every
one is accounted for:

| Web change                                                            | Mobile                                  |
| --------------------------------------------------------------------- | --------------------------------------- |
| `portal/patient-finder/*` (new)                                       | not ported — deliberate                 |
| `portal/overview/*` — wrapped in `@if (showFinder())`                 | not applicable, no finder               |
| `core/auth/acting-as.service.ts` — adopted choice                     | not applicable, mobile persists nothing |
| `onboarding/onboarding.guard.ts` — the administrator fix              | **not ported — the gap above**          |
| `layouts/navbar/*`, `layouts/profiles/*` — `/management/info` removed | not applicable, never copied            |
| `i18n/*/patientPortal.json` — 19 finder keys                          | not applicable                          |

Nothing else in the web app has moved since the port, which is the useful half of this table: the
divergence is small, recent, and entirely enumerable.

## Decisions — 2026-08-23

Taken by the architect after this sweep was written. Recorded here rather than in a commit message
because each one reverses something the sweep argued for, and the reasoning above should not be read
as still standing.

### The finder is ported, and an administrator gets it on the phone

**Decided: build a mobile patient finder** — `portal/patient-finder/`, `ActingAsService.open()`, an
administrator branch in the fork, and the seventeen `finder.*` keys across three locales.

The sweep argued the other way, on the grounds that an administrative surface on a patient's phone is
a thing to avoid. That concern does not disappear because the decision went against it, so it is
worth stating what it now rests on: an administrator holding a phone can search every patient in the
system and open any record. The protections are the ones that already exist — `ROLE_ADMIN` is
unrestricted server-side either way, the acting-as banner names whose record is on screen, and
`PatientScope` narrows a caller who has chosen a patient. Nothing new is granted; what changes is
that the reach is now in a pocket rather than at a desk.

`[x]` Built, 2026-08-23. `portal/patient-finder/` is a route of its own rather than a branch inside
the overview — there is no overview to branch inside until a record is chosen. The fork answers
`finder` for `ROLE_ADMIN`, before fetching delegations, since that call has nothing to say about
somebody holding none.

**It shipped with a hole, found and fixed the same day.** An administrator reaches a record by
searching, so after opening one they hold exactly one choice — which made `canSwitch` false and left
no route to a second patient short of signing out. The record picker could never have helped: it
lists what is already available, and the point is reaching somebody who is not. The banner now
carries a second action, keyed on the role rather than the choice count.

### Registration and password reset both land on mobile

**Decided: both**, not reset alone. Note the consequence the option carried and accept it: onboarding
itself stays web-only (§7 drops the wizard deliberately), so somebody who registers on the phone
activates by email, signs in, and is sent straight to the `onboarding-required` dead end telling them
to finish on the web. That is a worse first run than not offering registration at all, unless the
dead end is rewritten to explain it — which is now part of this work rather than a separate question.

`account/*` therefore does **not** join the never-copied list, and the three interceptor allowlist
entries stop being plumbing without a purpose.

`[x]` Built, 2026-08-23, and it needed one new i18n key rather than three screens' worth — the
scaffold had shipped `register.*` and `reset.*` in all three locales already. The dead end is
reworded, as this decision carried.

Two things the work turned up. The reset mail's link had nowhere to land: the Android intent filter
already claimed every link on the host, but nothing routed one, so the key was dropped —
`DeepLinkService` now routes an allowlist of two paths. And both forms trimmed on the way _out_
while `Validators.email` rejects a trailing space, so an address pasted from a mail app left the
form invalid and blamed the address. Both now trim before validity is checked.

### Archived cases appear on both apps, collapsed

**Decided: show them**, in a collapsed "Archived" section on the cases screen of both apps, fetched
with `includeArchived=true` and showing when and by whom.

This is the first patient-facing surface for archiving, and it decides something the api left open: a
patient can now see that a clinician retired one of their cases, and the reason that clinician typed.
`archiveReason` was specified as required precisely so it would never be empty, and it was written on
the assumption of a clinical audience. Whether to render it, or only the fact and the date, is the
one sub-decision left open here — the safer default is to show the date and the archivist and to keep
the reason for the case detail screen.

`[x]` Built, 2026-08-23, on both apps. The date and the archivist are shown; the reason is not, and
that sub-decision stays open. Note a constraint that forced part of it: `archivedById` is a _login_
rather than a `Professional` id — the api stamps `getCurrentUserLogin()` because no reliable mapping
exists — so there is no name to resolve it to and the raw login is what appears.

The work also fixed something the api's archiving default had already broken silently: `casesById$`
was built from the live list, so a report attached to a case somebody later archived was rendering
with its case name missing.

### `visitations` and `activity` join the navigation

**Decided: add them**, both apps. Ten nav entries become twelve, and every routed screen except case
detail — which is reached from a case, correctly — becomes reachable. This closes `patient-web.md`
Phase E B1 rather than re-recording it as deliberate.

`[x]` Built, 2026-08-23, on both apps. Labels reuse each screen's own title, so tapping
"Visitations" opens a page headed "Visitations", and all three locales already carried those strings
under `title.*`.

## Decisions — 2026-08-25

### Asking to be deleted, on both apps and answered by an administrator

**Decided: build it**, because Google Play requires an app that lets people create accounts to offer
account deletion from inside the app — and this app added registration on 2026-08-23, which is what
brought the requirement with it. Play also requires a deletion route that works **without** the app,
for somebody who has uninstalled or cannot sign in; that is `abofonsa.com/delete-account`, on the
marketing site.

The shape follows what this codebase already believed rather than what the store asked for.
`ProfileResource.delete` has been `ROLE_ADMIN`-only since patient data became undeletable, and its
comment points at "what is meant to replace it" — a patient-raised request, an administrator-carried
erasure. So the patient's side of this is a `DeletionRequest` document and nothing more: **no client
in this platform calls anything that deletes.** The most a patient can do is start a fourteen-day
clock and stop it again.

Five repositories, and the whole of it is one contract:

| Repo                | What landed                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `hc-patient/api`    | `DeletionRequest` + `PatientErasureService`, `/api/deletion-requests` — patient-scoped raise/cancel, `ROLE_ADMIN` list/complete/reject |
| `hc-patient/mobile` | `/tabs/delete-account`, linked from Profile, two-step confirm, pending state with the date                                             |
| `hc-patient/web`    | `/portal/delete-account`, same three endpoints and the same i18n keys                                                                  |
| `hc-admin/app`      | The console queue, with the erasure behind a typed patient id                                                                          |
| `hc-abofonsa-web`   | `/privacy` and `/delete-account`, static rather than CMS content                                                                       |

Three things the work turned up that are worth keeping.

**An angel must not be able to do this.** A care delegation grants full read and write over somebody
else's record — §4's whole subject — so a deletion path that honoured `X-Acting-As` would make
erasure a thing a delegate could do _to_ a patient. Refused server-side and hidden client-side, and
the server check is the one that counts. An administrator with a patient open is refused for the
mirror-image reason: they can already complete a request, and what they must not be able to do is
manufacture the patient's consent for one.

**Completing the erasure cuts the account off immediately, and the tests say so out loud.** The
erasure takes the `Profile` with it, which is what `PatientScope` resolves a token's email into — so
the very next request from that account resolves to no patient and is refused. A test written
expecting `400` got `403` and the code was right; the assertion now documents it.

**The gateway route was missing and nothing said so.** `hc-admin`'s gateway routed only
`/services/hcadminservice/**`, so the console's queue would have 404'd at its own gateway and read as
a broken screen. Added in `hc-admin/deploy/prod-server/compose.yml`, copying the route
`hc-professional` already carries. **Not yet applied to a running gateway** — that is a deploy the
architect owns.

`[x]` Built, 2026-08-25, on both apps. `[ ]` The route above still has to be deployed, and the
Spanish `patientPortal` bundle still has no `deleteAccount.*` — that file deliberately does not exist
yet (`web/src/main/webapp/i18n/es/README.md`), so a Spanish reader sees the English strings. For an
irreversible action that is worth closing sooner than the clinical bundles it is queued behind.
