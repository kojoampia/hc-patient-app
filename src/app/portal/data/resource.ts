/**
 * New in hc-patient-app — no origin in the web repo, and it is the fix for a defect that exists
 * there (patient-mobile.md §7.5).
 *
 * THE PROBLEM. Every one of the web's twelve portal streams ends `catchError(() => of([]))`, so a
 * failed fetch and an empty collection are **the same value**. On a desktop that is untidy. On a
 * phone, which is offline regularly and by surprise, it renders as
 *
 *     "No allergies recorded"
 *
 * when the truth is that the request never arrived — and an allergy list is the worst possible
 * place for those two to read alike. Somebody deciding whether a drug is safe reads a confident
 * empty state produced by a dropped connection.
 *
 * So a stream carries which of the three states it is in, and `hpm-stream` renders all three so the
 * twelve cannot drift apart.
 */

import { HttpErrorResponse } from '@angular/common/http';

export type Resource<T> =
  | { state: 'loading' }
  | { state: 'loaded'; value: T }
  | { state: 'failed'; status: number | null; error: unknown };

/**
 * Shared instance. The loading state carries no data, so allocating a new object per emission would
 * make `distinctUntilChanged` and OnPush change detection see a change on every tick.
 */
export const LOADING: Resource<never> = { state: 'loading' };

export function loaded<T>(value: T): Resource<T> {
  return { state: 'loaded', value };
}

export function failed<T>(error: unknown): Resource<T> {
  return { state: 'failed', status: statusOf(error), error };
}

/**
 * The status `hpm-stream` keys its message off. `null` and `0` both mean "the request never
 * reached a server", which is the offline case and the one worth wording differently.
 */
export function statusOf(error: unknown): number | null {
  if (error instanceof HttpErrorResponse) {
    return error.status;
  }
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === 'number' ? status : null;
  }
  return null;
}

export function isLoading<T>(resource: Resource<T>): resource is { state: 'loading' } {
  return resource.state === 'loading';
}

export function isLoaded<T>(resource: Resource<T>): resource is { state: 'loaded'; value: T } {
  return resource.state === 'loaded';
}

export function isFailed<T>(resource: Resource<T>): resource is { state: 'failed'; status: number | null; error: unknown } {
  return resource.state === 'failed';
}

/**
 * The value, or a fallback while loading or failed.
 *
 * **Use this only where a fallback is honest.** §7.5 is explicit that anything `computed()` across
 * streams must decide what a failure MEANS for it: the overview's "3 of your 12 cases are active"
 * must not render while `cases$` is failed, because "0 active" would be a lie. Reach for
 * {@link isLoaded} and render nothing, rather than defaulting to zero, whenever the number itself
 * is the message.
 */
export function valueOr<T>(resource: Resource<T>, fallback: T): T {
  return resource.state === 'loaded' ? resource.value : fallback;
}

/** Maps the loaded value, passing loading and failed through untouched. */
export function mapResource<T, R>(resource: Resource<T>, fn: (value: T) => R): Resource<R> {
  return resource.state === 'loaded' ? loaded(fn(resource.value)) : resource;
}

/**
 * The rows a screen renders, or an empty array while loading or failed.
 *
 * Safe HERE and nowhere near a count: the list this feeds sits inside an `hpm-stream`, which is
 * showing the skeletons or the failure card at the same moment this returns `[]`, so the empty
 * array is never what the reader sees. Contrast {@link valueOr} used for a derived number, where
 * the empty array becomes a confident "0" — see the note on that function.
 */
export function rowsOf<T>(resource: Resource<readonly T[]>): readonly T[] {
  return resource.state === 'loaded' ? resource.value : [];
}
