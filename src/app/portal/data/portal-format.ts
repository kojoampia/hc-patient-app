/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/portal/data/portal-format.ts @ 12e418c
 * Divergence: one eslint-disable comment on the `line || digital || '—'` fallback in
 *   formatAddress. The `||` is correct — those are possibly-EMPTY strings, not nullables — but
 *   this repo enables prefer-nullish-coalescing, which the web does not hit because its lint has
 *   172 pre-existing problems and is not gating. No behaviour change.
 * Re-sync: see PROVENANCE.md.
 */

import dayjs from 'dayjs/esm';
import utc from 'dayjs/esm/plugin/utc';
import { IAddress } from 'app/entities/patientMS/address/address.model';

// Registered here rather than in config/dayjs.ts: that file carries a JHipster needle and is
// regenerated, and this is the portal's own dependency. Extending twice is a no-op.
dayjs.extend(utc);

/**
 * Formatting the portal agreed on once, so a date does not read three different ways on three
 * screens. Everything here is pure — no injection, no locale service — because these are used
 * inside `computed()` bodies where an injection context is not guaranteed.
 *
 * ## Instants are the clinic's, not the reader's — calendar dates belong to nobody
 *
 * The record holds two different kinds of value and they need opposite treatment:
 *
 * - An **instant** — `visitedAt`, `openedAt`, `raisedAt`, `scheduledAt`, `loggedAt`, `recordedAt` —
 *   is a point in time. The care happened in Accra and the record was written in Accra time; a
 *   reader elsewhere is reading someone else's appointment, not scheduling their own, so shifting
 *   it to their clock states something the record does not say. Rendered locally from UTC+2, a
 *   23:05 alert became 01:05 the following morning — the wrong *day* on a clinical record. Use
 *   {@link formatDayTime}, {@link formatTime} or {@link formatInstantDay}.
 * - A **calendar date** — `birthDate`, `notedOn`, `startedOn`, `reportDate`, `createdDate`,
 *   `schedule` — is a `LocalDate` with no time and no zone. It must not be converted at all. The
 *   entity services parse these with `dayjs('1976-04-19')`, which lands on *local* midnight, so
 *   converting to UTC from any zone east of it moves the date back a day: a birthday of 19 April
 *   renders as the 18th. Use {@link formatDay}.
 *
 * Ghana keeps UTC all year with no daylight saving, so `.utc()` *is* Accra and no timezone database
 * is needed. The day a second locale appears this becomes a real zone lookup — which is why the
 * instant formatters go through {@link inZone} rather than calling `.format()` themselves.
 *
 * ## Strings are tolerated, and should not be
 *
 * The entity services convert their date fields to `dayjs` objects; anything fetched around them
 * arrives as an ISO string. Handing one to a formatter used to throw `e.format is not a function`
 * mid-render, which Angular reports as a blank panel rather than as an error anyone can act on —
 * `/record` and the profile's About tab were both empty for exactly this reason. Accepting a string
 * costs one coercion and turns that class of mistake into a correctly formatted date. Fix the
 * source anyway: the type still says `Dayjs` because that is what callers should pass.
 */

/** What a formatter will accept. `string` is a tolerated input, not an endorsed one — see above. */
export type DateLike = dayjs.Dayjs | string | null | undefined;

const DAY = 'DD MMM YYYY';
const DAY_TIME = 'DD MMM YYYY, hh:mm A';
const TIME = 'hh:mm A';

/** Parses without moving the value, or null when there is nothing to show. */
function parse(value: DateLike): dayjs.Dayjs | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = dayjs.isDayjs(value) ? value : dayjs(value);
  return parsed.isValid() ? parsed : null;
}

/** Parses and moves to the record's timezone. For instants only — see the note above. */
function inZone(value: DateLike): dayjs.Dayjs | null {
  return parse(value)?.utc() ?? null;
}

/** "19 Apr 1976" — a **calendar date**, rendered as written. Never shifted. */
export function formatDay(value: DateLike): string {
  return parse(value)?.format(DAY) ?? '—';
}

/**
 * "24 Jul 2026" — the date an **instant** falls on, in the clinic's timezone.
 *
 * @param instant the moment the thing happened.
 * @param fallback a calendar date to show when there is no instant — for the records that carry
 *   `loggedAt ?? createdDate`, where the two are different kinds and only the first can be shifted.
 */
export function formatInstantDay(instant: DateLike, fallback?: DateLike): string {
  const moment = inZone(instant);
  if (moment) {
    return moment.format(DAY);
  }
  return fallback === undefined ? '—' : formatDay(fallback);
}

/** "24 Jul 2026, 02:00 PM" — an **instant**, where the time of day carries meaning. */
export function formatDayTime(value: DateLike): string {
  return inZone(value)?.format(DAY_TIME) ?? '—';
}

/** "02:00 PM" — an **instant**. */
export function formatTime(value: DateLike): string {
  return inZone(value)?.format(TIME) ?? '—';
}

/** One month's tally, ready to plot: `label` is the short month name, `value` the count. */
export interface MonthCount {
  readonly label: string;
  readonly value: number;
}

/**
 * Counts **instants** per calendar month, ending at the most recent and running back at most
 * `span` months.
 *
 * Months with nothing in them are kept, at zero. Plotting only the months that have something
 * turns a quiet spring into a continuous line and tells the patient their care never paused when
 * it did — and it makes the x-axis spacing a lie, since consecutive points would sit months apart.
 */
export function monthlyCounts(instants: readonly DateLike[], span = 12): MonthCount[] {
  const moments = instants.map(inZone).filter((moment): moment is dayjs.Dayjs => moment !== null);
  if (!moments.length) {
    return [];
  }
  const last = moments.reduce((latest, moment) => (moment.isAfter(latest) ? moment : latest)).startOf('month');
  const first = moments.reduce((earliest, moment) => (moment.isBefore(earliest) ? moment : earliest)).startOf('month');
  const months = Math.min(span, last.diff(first, 'month') + 1);

  return Array.from({ length: months }, (_, i) => {
    const month = last.subtract(months - 1 - i, 'month');
    return {
      label: month.format('MMM'),
      value: moments.filter(moment => moment.year() === month.year() && moment.month() === month.month()).length,
    };
  });
}

/** Sorts newest first, putting undated records last rather than at the top. */
export function byDateDesc<T>(pick: (item: T) => dayjs.Dayjs | null | undefined) {
  return (a: T, b: T): number => {
    const left = pick(a);
    const right = pick(b);
    if (!left && !right) {
      return 0;
    }
    if (!left) {
      return 1;
    }
    if (!right) {
      return -1;
    }
    return right.valueOf() - left.valueOf();
  };
}

/** Sorts soonest first, putting undated records last. */
export function byDateAsc<T>(pick: (item: T) => dayjs.Dayjs | null | undefined) {
  return (a: T, b: T): number => {
    const left = pick(a);
    const right = pick(b);
    if (!left && !right) {
      return 0;
    }
    if (!left) {
      return 1;
    }
    if (!right) {
      return -1;
    }
    return left.valueOf() - right.valueOf();
  };
}

/**
 * Case-insensitive substring match across several fields at once — what every search box on the
 * portal does. An empty needle matches everything.
 */
export function matches(needle: string, ...fields: (string | number | null | undefined)[]): boolean {
  const query = needle.trim().toLowerCase();
  if (!query) {
    return true;
  }
  return fields.some(field => field != null && String(field).toLowerCase().includes(query));
}

/** Turns an enum-ish value into a sentence-cased label: `IN_TREATMENT` -> `In treatment`. */
export function humanise(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Splits a list into pages of `size`, clamping the page number into range. */
export function pageOf<T>(items: readonly T[], page: number, size: number): readonly T[] {
  const total = Math.max(1, Math.ceil(items.length / size));
  const clamped = Math.min(Math.max(1, page), total);
  return items.slice((clamped - 1) * size, clamped * size);
}

/** Number of pages `items` occupies at `size` per page — always at least one. */
export function pageCount(items: readonly unknown[], size: number): number {
  return Math.max(1, Math.ceil(items.length / size));
}

/**
 * An address as one line.
 *
 * <p>`Profile.address` became a document when care onboarding needed a structured one, and every template that used to
 * interpolate it would otherwise print `[object Object]` — silently, and only for patients who have an address at all.
 * Empty parts are dropped rather than rendered as gaps, so a record with only a street still reads as a street.</p>
 */
export function formatAddress(address: IAddress | null | undefined): string {
  if (!address) {
    return '—';
  }
  const line = [address.streetAddress, address.town, address.city, address.district, address.region, address.country]
    .map(part => part?.trim())
    .filter((part): part is string => !!part)
    .join(', ');
  // The digital address is the one people in Ghana actually quote, so it is kept even when nothing else is filled in.
  const digital = address.digitalAddress?.trim();
  if (line && digital) {
    return `${line} (${digital})`;
  }
  // `||`, NOT `??`, and this is the one place in the file where that distinction matters.
  // `line` and `digital` are trimmed strings that are frequently EMPTY, not null — `??` would
  // return '' and render a blank address instead of falling through to the em dash.
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return line || digital || '—';
}
