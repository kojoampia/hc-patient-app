import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { APP_ICONS } from './icons';

/**
 * The check that makes {@link APP_ICONS} maintainable.
 *
 * <p>A hand-written registry is the right shape here — the alternative ships ~1,300 SVGs to serve two dozen — but a
 * hand-written registry falls behind, and when it does nothing fails. The icon renders as an empty box and the app
 * carries on: the tab bar shipped with six labels and no pictures, and no build, lint or unit test objected.</p>
 *
 * <p>So this reads the source tree instead of trusting a list. It deliberately does NOT import Angular or render
 * anything: the failure being guarded against is a name that exists in a template and nowhere else, which is
 * invisible to any test that only exercises components it remembered to write a test for.</p>
 */
describe('every ion-icon the app names is registered', () => {
  const SRC = join(__dirname, '..');

  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return sources(path);
      }
      return /\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
    });
  }

  /**
   * Two patterns, because the first version of the registry was built from the first pattern alone and missed
   * everything bound rather than written literally — which was most of the app, the whole tab bar included.
   *
   * - any `…-outline` string literal: ionicons' own naming, and not a name `hpm-icon` uses for its inline set
   * - `name="…"` on an `<ion-icon>` element: catches the handful that are not `-outline` (`chevron-back`,
   *   `ellipsis-horizontal`, `lock-closed`)
   */
  function namesIn(text: string): string[] {
    const outlines = text.match(/[a-z]+(?:-[a-z]+)*-outline/g) ?? [];
    const literals = [...text.matchAll(/<ion-icon[^>]*\bname="([a-z][a-z-]*)"/g)].map(match => match[1]);
    return [...outlines, ...literals];
  }

  it('finds no name missing from APP_ICONS', () => {
    const used = new Map<string, string[]>();

    for (const file of sources(SRC)) {
      for (const name of namesIn(readFileSync(file, 'utf8'))) {
        used.set(name, [...(used.get(name) ?? []), file.slice(SRC.length + 1)]);
      }
    }

    // Reported with the files that need it, so the fix is "add these" rather than "go and find them".
    const missing = [...used.entries()]
      .filter(([name]) => !(name in APP_ICONS))
      .map(([name, files]) => `${name} — used in ${[...new Set(files)].join(', ')}`);

    expect(missing).toEqual([]);
    // Guards the guard: a regex that stopped matching would pass this file vacuously.
    expect(used.size).toBeGreaterThan(10);
  });
});
