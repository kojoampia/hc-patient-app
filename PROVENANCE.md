# Provenance

This app is built by **copying** shared TypeScript out of `hc-patient-dashboard` rather than depending on it.
`patient-mobile.md` §6 decision 3 records why: the two are independent git repositories with no monorepo tooling and
no private npm registry, so a package would be new infrastructure and a subtree would be a third repo.

The cost of that choice is **silent drift**, and this file is the entire control on it. Read the limits section
before trusting it.

## How a lifted file is marked

Every copied file opens with:

```ts
/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/portal-format.ts @ 12e418c
 * Divergence: none.          // or a one-line summary of every deliberate change
 * Re-sync: see PROVENANCE.md.
 */
```

The header is the per-file record; the table below is the index. **Both, or neither** — a header without a row
cannot be checked in bulk, and a row without a header is invisible to whoever opens the file.

## How to check

```bash
npm run provenance          # → node tools/check-provenance.mjs ../web
```

For each row it runs `git -C ../web log --oneline <sha>..HEAD -- <origin>` and prints every origin file that has
moved since it was lifted. A moved origin is **blocking for a release**: read the diff, then either port the change
and bump the sha, or record why not in the Divergence column.

Run it at the start of every phase and before every release.

## Limits — read this before relying on it

- **CI cannot run this.** It needs a sibling `../web` checkout, which the runner does not have. There is no
  automated gate; it is a checklist item and nothing more.
- **It detects that an origin moved, not whether the change matters.** A prettier reflow and a fixed timezone bug
  look identical here.
- **It cannot see divergence introduced on this side.** A local edit to a lifted file with no header update is
  invisible. That is what code review is for.
- If these two copies do start drifting in a way that costs real time, the fix is not a better script: publish
  `portal/data/` and the entity models and services from the web repo as a private package, and delete this file.

## Lifted files

`web` origin paths are relative to `src/main/webapp/`. Target paths are relative to `src/`.

Baseline for the whole first pass: **`12e418c`** (`kojoampia/hc-patient-dashboard`, `main`, 2026-08-20).

| Target | Origin (`web`) | SHA | Divergence |
| ------ | -------------- | --- | ---------- |
| `theme/_tokens.scss` | `content/scss/_tokens.scss` | 12e418c | `$hc-ok` and `$hc-warn` darkened for AA — see Known divergences |
| `theme/_components.scss` | `content/scss/_components.scss` | 12e418c | web's `.hc-plan` block not taken — see Known divergences |
| `theme/_utilities.scss` | `content/scss/_utilities.scss` | 12e418c | none |
| `i18n/en/*.json` | `i18n/en/*.json` | 12e418c | none |
| `i18n/fr/*.json` | `i18n/fr/*.json` | 12e418c | 1 key added — `health.status.OUT_OF_SERVICE` |
| `i18n/de/*.json` | `i18n/de/*.json` | 12e418c | 10 keys added — see Known divergences |
| `app/core/config/application-config.service.ts` | `app/core/config/application-config.service.ts` | 12e418c | none |
| `app/core/config/application-config.service.spec.ts` | `app/core/config/application-config.service.spec.ts` | 12e418c | none |
| `app/core/request/request-util.ts` | `app/core/request/request-util.ts` | 12e418c | none |
| `app/core/request/request.model.ts` | `app/core/request/request.model.ts` | 12e418c | none |
| `app/core/util/operators.ts` | `app/core/util/operators.ts` | 12e418c | none |
| `app/core/util/operators.spec.ts` | `app/core/util/operators.spec.ts` | 12e418c | none |
| `app/core/util/event-manager.service.ts` | `app/core/util/event-manager.service.ts` | 12e418c | none |
| `app/core/util/event-manager.service.spec.ts` | `app/core/util/event-manager.service.spec.ts` | 12e418c | none |
| `app/core/util/alert.service.ts` | `app/core/util/alert.service.ts` | 12e418c | none |
| `app/core/auth/account.model.ts` | `app/core/auth/account.model.ts` | 12e418c | none |
| `app/core/auth/account.service.ts` | `app/core/auth/account.service.ts` | 12e418c | none |
| `app/core/auth/account.service.spec.ts` | `app/core/auth/account.service.spec.ts` | 12e418c | none |
| `app/core/auth/auth-jwt.service.ts` | `app/core/auth/auth-jwt.service.ts` | 12e418c | none |
| `app/core/auth/auth-jwt.service.spec.ts` | `app/core/auth/auth-jwt.service.spec.ts` | 12e418c | two storage cases replaced — see Known divergences |
| `app/core/auth/user-route-access.service.ts` | `app/core/auth/user-route-access.service.ts` | 12e418c | none |
| `app/core/auth/state-storage.service.ts` | `app/core/auth/state-storage.service.ts` | 12e418c | delegates to SessionTokenService + Preferences — see Known divergences |
| `app/core/auth/acting-as.service.ts` | `app/core/auth/acting-as.service.ts` | 12e418c | sessionStorage removed — see Known divergences |
| `app/core/interceptor/auth.interceptor.ts` | `app/core/interceptor/auth.interceptor.ts` | 12e418c | none |
| `app/core/interceptor/auth.interceptor.spec.ts` | `app/core/interceptor/auth.interceptor.spec.ts` | 12e418c | none |
| `app/core/interceptor/acting-as.interceptor.ts` | `app/core/interceptor/acting-as.interceptor.ts` | 12e418c | none |
| `app/core/interceptor/acting-as.interceptor.spec.ts` | `app/core/interceptor/acting-as.interceptor.spec.ts` | 12e418c | none |
| `app/core/interceptor/auth-expired.interceptor.ts` | `app/core/interceptor/auth-expired.interceptor.ts` | 12e418c | none — the §6 decision 4 lock/clear triggers land in phase 6 |
| `app/core/interceptor/error-handler.interceptor.ts` | `app/core/interceptor/error-handler.interceptor.ts` | 12e418c | none |
| `app/core/interceptor/notification.interceptor.ts` | `app/core/interceptor/notification.interceptor.ts` | 12e418c | none |
| `app/core/interceptor/index.ts` | `app/core/interceptor/index.ts` | 12e418c | none |
| `app/config/authority.constants.ts` | `app/config/authority.constants.ts` | 12e418c | none |
| `app/config/error.constants.ts` | `app/config/error.constants.ts` | 12e418c | none |
| `app/config/input.constants.ts` | `app/config/input.constants.ts` | 12e418c | none |
| `app/config/dayjs.ts` | `app/config/dayjs.ts` | 12e418c | none |
| `app/config/translation.config.ts` | `app/config/translation.config.ts` | 12e418c | I18N_HASH imported, not a webpack global — see Known divergences |
| `app/login/login.model.ts` | `app/login/login.model.ts` | 12e418c | none |
| `app/login/login.service.ts` | `app/login/login.service.ts` | 12e418c | none |
| `app/login/login.service.spec.ts` | `app/login/login.service.spec.ts` | 12e418c | none |
| `app/portal/data/care-delegation.service.ts` | `app/portal/data/care-delegation.service.ts` | 12e418c | `MineResponse.self`/`.delegations` made optional — see Known divergences |
| `app/onboarding/onboarding-status.service.ts` | `app/onboarding/onboarding.service.ts` | 12e418c | read half only; also carries `OnboardingStatus` from the sibling `onboarding.model.ts` — see Known divergences |
| `app/entities/patientMS/activity-log/activity-log.model.ts` | `app/entities/patientMS/activity-log/activity-log.model.ts` | 12e418c | none |
| `app/entities/patientMS/activity-log/service/activity-log.service.ts` | `app/entities/patientMS/activity-log/service/activity-log.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/address/address.model.ts` | `app/entities/patientMS/address/address.model.ts` | 12e418c | none |
| `app/entities/patientMS/address/service/address.service.ts` | `app/entities/patientMS/address/service/address.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/allergy/allergy.model.ts` | `app/entities/patientMS/allergy/allergy.model.ts` | 12e418c | none |
| `app/entities/patientMS/allergy/service/allergy.service.ts` | `app/entities/patientMS/allergy/service/allergy.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/care-plan-item/care-plan-item.model.ts` | `app/entities/patientMS/care-plan-item/care-plan-item.model.ts` | 12e418c | none |
| `app/entities/patientMS/care-plan-item/service/care-plan-item.service.ts` | `app/entities/patientMS/care-plan-item/service/care-plan-item.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/clinical-case/clinical-case.model.ts` | `app/entities/patientMS/clinical-case/clinical-case.model.ts` | 12e418c | none |
| `app/entities/patientMS/clinical-case/service/clinical-case.service.ts` | `app/entities/patientMS/clinical-case/service/clinical-case.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/condition/condition.model.ts` | `app/entities/patientMS/condition/condition.model.ts` | 12e418c | none |
| `app/entities/patientMS/condition/service/condition.service.ts` | `app/entities/patientMS/condition/service/condition.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/emergency/emergency.model.ts` | `app/entities/patientMS/emergency/emergency.model.ts` | 12e418c | none |
| `app/entities/patientMS/emergency/service/emergency.service.ts` | `app/entities/patientMS/emergency/service/emergency.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/medication/medication.model.ts` | `app/entities/patientMS/medication/medication.model.ts` | 12e418c | none |
| `app/entities/patientMS/medication/service/medication.service.ts` | `app/entities/patientMS/medication/service/medication.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/membership/membership.model.ts` | `app/entities/patientMS/membership/membership.model.ts` | 12e418c | none |
| `app/entities/patientMS/membership/service/membership.service.ts` | `app/entities/patientMS/membership/service/membership.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/professional/professional.model.ts` | `app/entities/patientMS/professional/professional.model.ts` | 12e418c | none |
| `app/entities/patientMS/professional/service/professional.service.ts` | `app/entities/patientMS/professional/service/professional.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/profile/profile.model.ts` | `app/entities/patientMS/profile/profile.model.ts` | 12e418c | none |
| `app/entities/patientMS/profile/service/profile.service.ts` | `app/entities/patientMS/profile/service/profile.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/report/report.model.ts` | `app/entities/patientMS/report/report.model.ts` | 12e418c | none |
| `app/entities/patientMS/report/service/report.service.ts` | `app/entities/patientMS/report/service/report.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/stat/stat.model.ts` | `app/entities/patientMS/stat/stat.model.ts` | 12e418c | none |
| `app/entities/patientMS/stat/service/stat.service.ts` | `app/entities/patientMS/stat/service/stat.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/task/task.model.ts` | `app/entities/patientMS/task/task.model.ts` | 12e418c | none |
| `app/entities/patientMS/task/service/task.service.ts` | `app/entities/patientMS/task/service/task.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/visitation/visitation.model.ts` | `app/entities/patientMS/visitation/visitation.model.ts` | 12e418c | none |
| `app/entities/patientMS/visitation/service/visitation.service.ts` | `app/entities/patientMS/visitation/service/visitation.service.ts` | 12e418c | constructor params -> inject() — see Known divergences |
| `app/entities/patientMS/recommendation/recommendation.model.ts` | `app/entities/patientMS/recommendation/recommendation.model.ts` | 12e418c | none — required by ClinicalCase's many-to-many |
| `app/entities/enumerations/*` | `app/entities/enumerations/*` | 12e418c | none |
| `app/portal/data/patient-context.service.ts` | `app/portal/data/patient-context.service.ts` | 12e418c | profileState$ / careTeamState$ — see Known divergences |
| `app/portal/data/patient-context.service.spec.ts` | `app/portal/data/patient-context.service.spec.ts` | 12e418c | unwraps Resource; assertions unchanged |
| `app/portal/data/portal-format.ts` | `app/portal/data/portal-format.ts` | 12e418c | one eslint-disable — see Known divergences |
| `app/portal/data/portal-format.spec.ts` | `app/portal/data/portal-format.spec.ts` | 12e418c | none |
| `app/portal/data/vitals.ts` | `app/portal/data/vitals.ts` | 12e418c | none |
| `app/portal/data/status-label.pipe.ts` | `app/portal/data/status-label.pipe.ts` | 12e418c | none |
| `app/portal/data/status-label.pipe.spec.ts` | `app/portal/data/status-label.pipe.spec.ts` | 12e418c | none |
| `app/portal/data/membership-plan.service.ts` | `app/portal/data/membership-plan.service.ts` | 12e418c | none |
| `app/portal/data/report-upload.service.ts` | `app/portal/data/report-upload.service.ts` | 12e418c | none |
| `app/shared/ui/icon/icon.constants.ts` | `app/shared/ui/icon/icon.constants.ts` | 12e418c | none |
| `app/shared/ui/charts/trend-chart.component.ts` | `app/shared/ui/charts/trend-chart.component.ts` | 12e418c | SharedModule -> TranslateModule; selector hpd -> hpm |
| `app/shared/ui/empty-state/empty-state.component.ts` | `app/shared/ui/empty-state/empty-state.component.ts` | 12e418c | REWRITTEN, not lifted — see Known divergences |
| `app/shared/language/translate.directive.ts` | `app/shared/language/translate.directive.ts` | 12e418c | `[hpdTranslate]` -> `[hpmTranslate]` |
| `app/shared/language/find-language-from-key.pipe.ts` | `app/shared/language/find-language-from-key.pipe.ts` | 12e418c | none |
| `app/shared/ui/icon/icon.component.ts` | `app/shared/ui/icon/icon.component.ts` | 12e418c | SharedModule -> TranslateDirective; hpd -> hpm |
| `app/shared/ui/avatar/avatar.component.ts` | `app/shared/ui/avatar/avatar.component.ts` | 12e418c | hpd -> hpm |
| `app/shared/ui/panel/panel.component.ts` | `app/shared/ui/panel/panel.component.ts` | 12e418c | SharedModule -> TranslateDirective; hpd -> hpm |
| `app/shared/ui/pager/pager.component.ts` | `app/shared/ui/pager/pager.component.ts` | 12e418c | SharedModule -> TranslateModule; hpd -> hpm |
| `app/shared/ui/search-box/search-box.component.ts` | `app/shared/ui/search-box/search-box.component.ts` | 12e418c | SharedModule -> TranslateModule; hpd -> hpm |
| `app/shared/ui/person-filter/person-filter.component.ts` | `app/shared/ui/person-filter/person-filter.component.ts` | 12e418c | SharedModule -> TranslateModule; hpd -> hpm |
| `app/shared/ui/charts/bar-chart.component.ts` | `app/shared/ui/charts/bar-chart.component.ts` | 12e418c | SharedModule -> TranslateDirective; hpd -> hpm |
| `app/shared/ui/charts/sparkline.component.ts` | `app/shared/ui/charts/sparkline.component.ts` | 12e418c | hpd -> hpm |
| `app/shared/ui/charts/stack-bar.component.ts` | `app/shared/ui/charts/stack-bar.component.ts` | 12e418c | SharedModule -> TranslateDirective; hpd -> hpm |
| `app/portal/emergencies/emergencies.page.ts` | `app/portal/emergencies/emergencies.component.ts` | 12e418c | logic adapted to Resource<T>; template rewritten for Ionic |
| `app/portal/visitations/visitations.page.ts` | `app/portal/visitations/visitations.component.ts` | 12e418c | as above; the 5-column table becomes a card list |
| `app/portal/activity/activity.page.ts` | `app/portal/activity/activity.component.ts` | 12e418c | as above; kind filter scrolls horizontally |
| `app/portal/cases/cases.page.ts` | `app/portal/cases/cases.component.ts` | 12e418c | adapted to Resource<T>; template rewritten for Ionic |
| `app/portal/case-detail/case-detail.page.ts` | `app/portal/case-detail/case-detail.component.ts` | 12e418c | adapted to Resource<T>; template rewritten for Ionic |
| `app/portal/medications/medications.page.ts` | `app/portal/medications/medications.component.ts` | 12e418c | adapted to Resource<T>; template rewritten for Ionic |
| `app/portal/reports/reports.page.ts` | `app/portal/reports/reports.component.ts` | 12e418c | adapted to Resource<T>; template rewritten for Ionic |
| `app/portal/plans/plans.page.ts` | `app/portal/plans/plans.component.ts` | 12e418c | adapted to Resource<T>; template rewritten for Ionic |
| `app/portal/allergies/allergies.page.ts` | `app/portal/allergies/allergies.component.ts` | 12e418c | adapted to Resource<T>; template rewritten for Ionic |
| `app/portal/schedules/schedules.page.ts` | `app/portal/schedules/schedules.component.ts` | 12e418c | adapted to Resource<T>; template rewritten for Ionic |
| `app/portal/record/record.page.ts` | `app/portal/record/record.component.ts` | 12e418c | adapted to Resource<T>; template rewritten for Ionic |
| `app/portal/profile/profile.page.ts` | `app/portal/profile/profile.component.ts` | 12e418c | adapted to Resource<T>; template rewritten for Ionic |
| `app/portal/overview/overview.page.ts` | `app/portal/overview/overview.component.ts` | 12e418c | adapted to Resource<T>; template rewritten for Ionic |

All thirteen screens are ADAPTATIONS, not lifts (§7.2 rewrites every template, and the component
logic changes shape with it because the streams carry `Resource<T>`). The rows name the origin so
`npm run provenance` still reports when the web's version moves.

Recurring divergences across the thirteen, so they are not restated on each row:

- **Tables become card lists.** Five and six-column `.hc-tbl` at 390px scrolls sideways inside its
  wrapper and is unreadable.
- **Pagers are dropped.** A phone scrolls, and on the record screen each panel's full screen is one
  tap away — a pager inside a panel competes with the tab bar.
- **Case links go through `PortalNavService`,** never a `routerLink` to `/case/:id`: the detail is
  registered under all five tabs and must open on the stack the reader is already on.
- **`window.print()` is dropped** wherever the web offered it.
- **`shared/ui/modal` is never lifted** — Ionic owns overlays, so every dialog is an `ion-modal`.
- **Derived counts return `null` rather than `0`** when their stream is not loaded (§7.5). This is
  the single most repeated change and the one with the most consequence; `portal/derived-counts.spec.ts`
  pins it in one place.
- **Overview drops three analytics charts** (visit trend, case distribution, care-team load): wide
  multi-series figures that are unreadable rather than merely small at 390px. The vitals trend stays.

**`shared/ui/modal/` is not lifted and will not be.** Ionic owns overlays here — `ion-modal` with the
dismissal rules §7.4.4 requires — so the web's hand-rolled modal has no role. Same for
`shared/ui/pager`: it is lifted for completeness but the phone lists scroll rather than paginate, so
nothing renders it yet.

**Every `portal/*` screen is an ADAPTATION, not a lift.** §7.2 rewrites every template, and the
component logic then has to change shape too because the streams carry `Resource<T>`. The rows above
name the origin so `npm run provenance` still reports when the web's version moves — the logic is
close enough that a change there is usually a change here.

Phase 4 pulled three more files forward from phase 5, each because something in the data layer does
not compile without it: `recommendation.model.ts` (ClinicalCase has a many-to-many to it),
`icon.constants.ts` and `trend-chart.component.ts` (both imported by `vitals.ts` for their TYPES —
`IconName` and `TrendPoint`). The chart turned out to be hand-rolled SVG with no d3 or ngx-charts
behind it, so lifting it cost nothing but the SharedModule swap.

**`portal-data.service.ts` is REWRITTEN, not lifted**, and so has no row above. §7.2 lists it as the
one rewritten file in `portal/data/`. Its origin is
`src/main/webapp/app/portal/data/portal-data.service.ts @ 12e418c`; it is named here so nobody goes
looking for a lift that does not exist.

Two more files moved forward from the phase the plan assigned them, for the same reason i18n did in
phase 1 — the fork cannot run without them. `care-delegation.service.ts` was listed under phase 4,
but `/care-delegations/mine` **is** the fork (§3.1). The onboarding status call was not listed at
all, because §6 decision 2 drops the wizard; only its read half is here, and §2.3's rule (read
`onboarded`, never re-derive it from `status`) is the reason it could not simply be inferred from
`mine()`'s `self.onboardingStatus`.

Three files the plan's §7.2 lift list does not name were lifted anyway, because the five
interceptors do not compile without them: `core/util/event-manager.service.ts` and
`core/util/alert.service.ts` (dependencies of `ErrorHandlerInterceptor` and
`NotificationInterceptor`) and `core/auth/acting-as.service.ts` (a dependency of both
`ActingAsInterceptor` and `LoginService`). None drags ng-bootstrap or Font Awesome in —
`AlertService` needs only `DomSanitizer` and `TranslateService` — so the "never copied" rule about
`shared.module.ts` is not breached. **What renders an alert is still to be written**: `AlertService`
only accumulates them, and on a phone they should become an `ion-toast` rather than the web's
alert strip. That is phase 5's problem, noted here so it is not mistaken for done.

Lifted in phase 1 rather than phase 2 as the plan anticipated: `tools/merge-i18n.mjs` cannot be
written, let alone gated, without the bundles it merges. The plan's phase-2 row for `i18n/*` is
therefore already satisfied.

Not lifted, and deliberately so: `content/scss/global.scss` (Bootstrap-dependent; `src/global.scss`
is a new file that imports the three above in a fixed order), `content/scss/_bootstrap-variables.scss`
and `content/scss/vendor.scss` (no Bootstrap here).

### Rows to expect, by phase

Listed so the table's shape is set before it is filled, and so a phase cannot quietly skip its entries.

- **Phase 2** — `app/core/config/application-config.service.ts`, `app/core/interceptor/*` (five files plus
  `index.ts`), `app/core/request/request-util.ts`, `app/core/util/operators.ts`,
  `app/core/auth/{account.model,account.service,user-route-access.service,auth-jwt.service,state-storage.service}.ts`,
  `app/config/{authority.constants,input.constants,dayjs,error.constants,translation.config}.ts`,
  `app/login/{login.model,login.service}.ts`, `i18n/{en,fr,de}/*.json`.
- **Phase 4** — `app/portal/data/{portal-format,vitals,status-label.pipe,care-delegation.service,
  membership-plan.service,patient-context.service}.ts` **and their specs**, `app/entities/enumerations/*`, and 15
  entities' `<e>.model.ts` + `service/<e>.service.ts` (`activity-log, address, allergy, care-plan-item,
  clinical-case, condition, emergency, medication, membership, professional, profile, report, stat, task,
  visitation`).
- **Phase 5** — `app/shared/ui/{icon,charts,avatar,empty-state,panel,pager,search-box,person-filter}/*`,
  `app/shared/language/*`.
- **Phase 1** — `content/scss/{_tokens,_components,_utilities}.scss` → `theme/`.

## Known divergences

Recorded here as well as in the file headers, because these are the ones somebody will otherwise "fix" back.

| Where | Divergence | Why |
| ----- | ---------- | --- |
| `theme/_components.scss` | The `.hc-plan` block web added for backlog item 12 is not copied | That block exists because the web chooser was laying a plan card out as an `.hc-kv` row. This app never had that defect — its plan cards are already `hc-card hc-card-pad` — and item 12 puts mobile's layout out of scope, so copying ~110 lines of unreachable CSS into the bundle buys nothing. Take it if and when the Ionic chooser grows a feature list. |
| `theme/_tokens.scss` | `$hc-warn` `#b4741a` → `#8f5c14` (3.50:1 → 5.15:1); `$hc-ok` `#2e7d5b` → `#286d4f` (4.39:1 → 5.44:1) | On their own backgrounds the web values fail AA and are marginal respectively; measured, not estimated. Worse at phone pill sizes. **Raise on the web repo** — the fix belongs there too. |
| `i18n/fr/health.json` | `health.status.OUT_OF_SERVICE` added as "HORS SERVICE"; `DOWN` changed "HORS SERVICE" → "INDISPONIBLE" | The key was missing in `fr` upstream. "HORS SERVICE" is the literal reading of OUT_OF_SERVICE, so it moved there, and DOWN took a distinct word — otherwise two different statuses render identically on a health screen. **This edits an existing web string; raise it upstream.** |
| `i18n/de/*.json` | 10 keys added: `entity.validation.patternLogin`, `health.status.OUT_OF_SERVICE`, and 8 × `metrics.cache.*` | All missing upstream. `health.status.*` keeps the untranslated-literal convention the rest of that block already uses in `de`. **Raise upstream.** |
| `entities/patientMS/*/service/*.service.ts` (15) | Constructor parameter properties replaced with `inject()`, injected fields declared ABOVE `resourceUrl` | The generated form initialises `resourceUrl` from a constructor parameter property, which only works when TypeScript downlevels class fields. Jest compiles with native ES2022 semantics (see tsconfig.spec.json), where the initialiser runs first and the service is built with an undefined config. The `inject()` form is correct under BOTH, and is what the member-ordering rule enforces. |
| `portal/data/patient-context.service.ts` | `profile$` -> `profileState$`, `careTeam$` -> `careTeamState$`, both `Resource<T>`; `patientId$` -> `patientIdState$` | §7.5. **`blankOnlyOn404` is unchanged — do not widen it.** A 404 is `loaded(null)` because "you have no profile" is a real state; anything else is `failed`. The web's `careTeam$` had the same `catchError(() => of([]))` defect and gets the same treatment. |
| `portal/data/portal-format.ts` | One `eslint-disable` on `line \|\| digital \|\| '—'` | The `||` is correct — those are possibly-empty strings, not nullables, and `??` would render a blank address. This repo gates on `prefer-nullish-coalescing`; the web does not, because its lint has 172 pre-existing problems. |
| `shared/ui/empty-state/empty-state.component.ts` | Rewritten rather than lifted | The web's imports `SharedModule` (never copied — it exports NgbModule and FontAwesomeModule) and `hpd-icon`, which is phase 5. Inputs and the rendered `.hc-empty` class are unchanged, so nothing downstream moves when phase 5 swaps the icon. |
| `portal/data/care-delegation.service.ts` | `MineResponse.self` and `.delegations` made optional | The web declares both required while its own code guards them (`self?.patientId`, `delegations ?? []`). The guards are right — §3.1 says the endpoint answers for a caller with no profile at all — and the type is wrong. Under `no-unnecessary-condition` the mismatch fails the build, and deleting the guards would be the wrong fix. **Raise upstream.** |
| `onboarding/onboarding-status.service.ts` | Only `OnboardingStatus` and `status()` copied | §6 decision 2 keeps the five-step wizard out of this app, so `start()`, the four PATCH steps, `complete()` and the care-angel call have no caller. The status read stays because the fork still has to know where to send somebody. |
| `core/auth/acting-as.service.ts` | `sessionStorage` persistence removed entirely | A webview "session" lasts weeks and survives process death and a different sign-in, so the web's storage rule stops being a safety property and becomes a defect. Replaced by the four reset triggers in `patient-mobile.md` §6 decision 4. |
| `core/auth/state-storage.service.ts` | Token methods delegate to `SessionTokenService`; `previousUrl` and `locale` move to Capacitor Preferences | Secure storage is async and `AuthInterceptor` needs a synchronous read. The shape is kept so the interceptor and `AuthServerProvider` port verbatim. See §7.6. |
| `core/interceptor/auth-expired.interceptor.ts` | Also clears the acting-as selection and locks the session on 401 | §6 decision 4's fourth trigger. |
| `core/auth/auth-jwt.service.spec.ts` | Two "read the token back out of web storage" cases replaced | They asserted the localStorage/sessionStorage mechanism §7.6 removed. The replacements assert the mobile contract and add the stronger negative: a token sitting in web storage must grant **nothing**, or a value left by an older build could silently sign somebody in. |
| `config/translation.config.ts` | `I18N_HASH` imported from the generated `environments/i18n-hash`; loader path `i18n/` → `assets/i18n/` | No DefinePlugin under esbuild (§7.7.2), and the hash changes per build so it cannot be a static `define` either. The path change follows `tools/merge-i18n.mjs`'s output location. |
| `portal/data/patient-context.service.ts` | `profile$` → `profileState$`, wrapped in `Resource<T>` | §7.5. **`blankOnlyOn404` is unchanged** — do not widen it. |
| `portal/data/portal-data.service.ts` | Rewritten, not lifted | Three-state streams and per-stream retry. Listed here because it has an obvious origin and someone will look for it. |
| Session bootstrap | A failed `/care-delegations/mine` gets a retry screen, not a silent fall back to "myself" | §8.3. The web's fallback is right for a desktop portal already showing the signed-in person; combined with the mobile cold-start reset it strands an angel-only user in an empty portal under their own name. |
| Everywhere | Selector and prefix `hpd` → `hpm` | Two Angular apps in one workspace should not share a selector prefix. |
