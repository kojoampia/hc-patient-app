# Mobile ↔ web parity

What `hc-patient-app` does and does not do, measured against `hc-patient-dashboard`.

- **Swept:** 2026-08-23, mobile at `d19ca07`, web at `da78e9a`.
- **Port point:** the app was lifted from web at `12e418c` (`PROVENANCE.md`), so "drift since the
  port" below is literally `git diff 12e418c..HEAD` over `web/src/main/webapp/app`.
- **Companion docs:** `patient-mobile.md` is the plan of record — §7.8 owns the phase criteria and
  §4/§5 own what mobile deliberately does differently. This file records the _result_ of comparing
  the two apps, not what was planned.

Status legend: `[x]` at parity · `[~]` deliberate divergence · `[ ]` gap.

## The short version

Parity is closer than the difference in size suggests. Every one of the thirteen portal screens
exists on both, the data layer is the same shape, the four chart components are the same four, the
write paths are the same three, and the i18n key sets differ by exactly the seventeen keys of a
screen mobile does not have.

**One real gap, and it is the same defect the web had until 2026-08-22:** an administrator signing in
lands on a dead end. Everything else below is either a documented decision or a shared gap the two
apps have equally.

## Gaps

### `[ ]` An administrator signing in reaches a dead end

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

### `[ ]` No account surfaces: no registration, no password reset

`auth.interceptor.ts` already allowlists `api/register`, `api/account/reset-password/init` and
`api/account/reset-password/finish` as unauthenticated paths — the plumbing anticipates screens that
do not exist. A person who has not got an account, or who has forgotten their password, cannot start
or recover from the phone; they have to reach the web app.

`patient-mobile.md` never lists `account/*` among the never-copied directories, unlike `admin/*` and
`layouts/*`, so this reads as unfinished rather than decided. It may well be the right scope for v1 —
but the interceptor entries are a standing hint that somebody expected otherwise.

### `[ ]` Nothing surfaces archived clinical cases

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

### `[ ]` `visitations` and `activity` are routed but not in the navigation

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
