import { TestBed } from '@angular/core/testing';

import { NativePromptGuard, RESUME_GRACE_MS, withPrompt } from './with-prompt';

/**
 * **THE MOST LIKELY BUG IN THIS AREA**, per patient-mobile.md §7.6, and the reason this file is a
 * spec rather than a comment.
 *
 * The biometric dialog, the camera, the file picker and the system browser ALL background the app
 * on Android. §6 decision 4 locks on resume after a long absence. So a naive listener sees the
 * unlock prompt background the app, sees it resume, and locks again — showing the prompt that
 * backgrounds the app, which locks again.
 *
 * Every individual piece of that loop looks correct in isolation. `withPrompt` is what breaks it,
 * and these tests are what stop somebody "simplifying" it away.
 */
describe('withPrompt — the lock loop', () => {
  let guard: NativePromptGuard;

  beforeEach(() => {
    jest.useFakeTimers();
    TestBed.configureTestingModule({});
    guard = TestBed.inject(NativePromptGuard);
  });

  afterEach(() => jest.useRealTimers());

  it('suppresses while the prompt is open', async () => {
    expect(guard.isSuppressed()).toBe(false);

    const running = withPrompt(guard, async () => {
      expect(guard.isSuppressed()).toBe(true);
      return 'ok';
    });

    await expect(running).resolves.toBe('ok');
  });

  /**
   * The resume event does not arrive at the same moment the promise resolves — `Browser.open`
   * resolves when the browser has been ASKED to open, and the appStateChange for the return lands
   * afterwards. Closing the window synchronously would leave the very event this exists to
   * suppress unsuppressed.
   */
  it('keeps suppressing for a grace period after the prompt returns', async () => {
    await withPrompt(guard, () => Promise.resolve());

    expect(guard.isSuppressed()).toBe(true);

    jest.advanceTimersByTime(RESUME_GRACE_MS + 1);
    expect(guard.isSuppressed()).toBe(false);
  });

  /**
   * A cancelled biometric prompt is a REJECTED promise. Leaking the suppression there would be
   * worse than the loop it prevents: the lock would be disabled entirely from then on, silently,
   * and the app would stop locking at all.
   */
  it('restores suppression even when the prompt throws', async () => {
    await expect(withPrompt(guard, () => Promise.reject(new Error('user cancelled')))).rejects.toThrow('user cancelled');

    jest.advanceTimersByTime(RESUME_GRACE_MS + 1);
    expect(guard.isSuppressed()).toBe(false);
  });

  /**
   * Nesting is real: a dead-end screen can open the system browser while a modal is already
   * suppressing. A boolean would un-suppress when the inner one finished, which is why the guard
   * counts.
   */
  it('nests, so an inner prompt finishing does not un-suppress the outer one', async () => {
    guard.enter();
    await withPrompt(guard, () => Promise.resolve());
    jest.advanceTimersByTime(RESUME_GRACE_MS + 1);

    expect(guard.isSuppressed()).toBe(true);

    guard.exit();
    jest.advanceTimersByTime(RESUME_GRACE_MS + 1);
    expect(guard.isSuppressed()).toBe(false);
  });

  it('never goes negative, so an unbalanced exit cannot disable suppression', () => {
    guard.exit();
    guard.exit();
    jest.advanceTimersByTime(RESUME_GRACE_MS + 1);

    guard.enter();
    expect(guard.isSuppressed()).toBe(true);
  });
});
