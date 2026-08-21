import { HttpErrorResponse } from '@angular/common/http';

import { LOADING, Resource, failed, isLoaded, loaded, mapResource, statusOf, valueOr } from './resource';

describe('Resource', () => {
  describe('statusOf', () => {
    it('reads an HttpErrorResponse', () => {
      expect(statusOf(new HttpErrorResponse({ status: 403 }))).toBe(403);
    });

    it('reads a plain object carrying a numeric status', () => {
      expect(statusOf({ status: 500 })).toBe(500);
    });

    it('is null for anything else, which hpm-stream words as "no connection"', () => {
      expect(statusOf(new Error('boom'))).toBeNull();
      expect(statusOf(undefined)).toBeNull();
      expect(statusOf({ status: 'nope' })).toBeNull();
    });
  });

  describe('mapResource', () => {
    it('maps a loaded value', () => {
      expect(mapResource(loaded([1, 2]), xs => xs.length)).toEqual(loaded(2));
    });

    it('passes loading and failed through untouched', () => {
      expect(mapResource(LOADING as Resource<number[]>, xs => xs.length)).toEqual(LOADING);

      const boom = failed<number[]>({ status: 500 });
      expect(mapResource(boom, xs => xs.length)).toBe(boom);
    });
  });

  /**
   * §7.5's LAST RULE, and the one most easily skipped because the code compiles either way:
   *
   *   "Anything computed() across streams must decide explicitly what a failure means for it. The
   *    overview's '3 of your 12 cases are active' must not render while cases$ is failed, because
   *    '0 active' would be a lie. Same for the emergencies badge: nothing on loading or failed,
   *    never 0."
   *
   * These are not tests of a component that exists yet — phase 5 builds the overview. They pin the
   * two helpers a component would reach for, and demonstrate which one is safe for a count.
   */
  describe('deriving across streams', () => {
    const activeCount = (cases: Resource<readonly { status?: string }[]>): number | null =>
      isLoaded(cases) ? cases.value.filter(c => c.status === 'OPEN').length : null;

    it('yields null rather than 0 while cases are loading or failed', () => {
      expect(activeCount(LOADING as Resource<readonly { status?: string }[]>)).toBeNull();
      expect(activeCount(failed({ status: 0 }))).toBeNull();
    });

    it('yields a real 0 only when the collection genuinely loaded empty', () => {
      expect(activeCount(loaded([]))).toBe(0);
    });

    it('counts normally once loaded', () => {
      expect(activeCount(loaded([{ status: 'OPEN' }, { status: 'CLOSED' }, { status: 'OPEN' }]))).toBe(2);
    });

    /**
     * `valueOr` is the tempting shortcut and it is WRONG for a count — it turns a dropped connection
     * into a confident "0 active cases". It is safe only where the fallback is honest, such as a
     * list that renders nothing while its own hpm-stream shows the failure beside it.
     */
    it('shows why valueOr must not be used for a count', () => {
      const lie = valueOr(failed<readonly { status?: string }[]>({ status: 0 }), []).length;

      expect(lie).toBe(0);
      expect(activeCount(failed({ status: 0 }))).toBeNull();
    });
  });
});
