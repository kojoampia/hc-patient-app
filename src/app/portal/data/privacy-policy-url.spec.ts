import { PRIVACY_POLICY_URL } from './deletion-request.service';

/**
 * Which host serves the privacy policy.
 *
 * <p>A spec for a constant looks like overreach until you know what it is guarding. This URL pointed at
 * `abofonsa.com/privacy` until 2026-08-31 — the launch-preview site, whose SPA fallback answers <b>200
 * with the countdown page</b> for every path. A patient who tapped "Read the privacy policy" on the
 * delete-my-record screen was shown a marketing countdown, on the one screen where they are deciding
 * whether to erase their medical history.</p>
 *
 * <p><b>Nothing could have failed.</b> The status was 200, the page rendered, the anchor was valid, and
 * no test in either client asks what a hardcoded external URL returns. It is the same shape as the
 * `routerLink` that opened a 404 and the `assetlinks.json` that answered `text/html` — this
 * subsystem's characteristic defect, which is always a wrong thing answering successfully.</p>
 *
 * <p>So this pins the decision rather than the string: change it deliberately, and when you do, check
 * the page's <i>content</i>. The status will be 200 either way.</p>
 *
 * <p>The twin of this spec lives in `hc-patient-dashboard`. Both clients hold their own copy of the
 * constant, so both need their own guard — a shared one would live in neither repository.</p>
 */
describe('the privacy policy URL', () => {
  it('points at the marketing site, which serves the policy', () => {
    // Verified 2026-08-31: 84,105 bytes, titled "Privacy policy — Abofonsa BridgeCare", and it states
    // the fourteen-day window that DeletionRequestService.WINDOW commits to.
    expect(PRIVACY_POLICY_URL).toBe('https://web.abofonsa.com/privacy');
  });

  it('does not point at the launch-preview host', () => {
    // abofonsa.com and www.abofonsa.com both answer 200 with the countdown page (4,944 bytes,
    // "Launching 1 February") for any path. If that host ever becomes the marketing site this test is
    // what makes moving back a decision instead of a coincidence.
    expect(PRIVACY_POLICY_URL).not.toMatch(/^https:\/\/(www\.)?abofonsa\.com\//);
  });

  it('is https and absolute, because it opens outside the app', () => {
    expect(PRIVACY_POLICY_URL.startsWith('https://')).toBe(true);
  });
});
