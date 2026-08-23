import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every translation key the app names must exist, in every locale.
 *
 * <p>A missing key does not throw and does not fail a build. It renders as `translation-not-found[some.key]` in the
 * middle of the screen, and only on a screen somebody actually opened — which is how a dozen of them reached a
 * handset at once, on the first portal screen anyone had ever managed to open on one.</p>
 *
 * <p>Reads the merged output under `src/assets/i18n`, not the per-feature sources under `src/i18n`, because the
 * merge is what the app loads and a key can be present in a source file and lost by the merge. `npm test` runs the
 * merge first (`pretest`), so the merged files are always current here.</p>
 */
describe('translation keys', () => {
  const APP = join(__dirname, '..');
  const I18N = join(__dirname, '..', '..', 'assets', 'i18n');

  const locales = readdirSync(I18N)
    .filter(name => name.endsWith('.json'))
    .map(name => [name.replace(/\.json$/, ''), JSON.parse(readFileSync(join(I18N, name), 'utf8')) as object] as const);

  /**
   * ngx-translate walks the dotted path, but tolerates a literal dotted key at any depth — which this codebase
   * relies on: `global.form.username.label` is stored as `{ global: { form: { "username.label": … } } }`, the
   * JHipster convention. A checker that only walked segment by segment would report a hundred false positives and
   * be switched off, which is worse than not having one.
   */
  function resolves(bundle: unknown, parts: readonly string[]): boolean {
    if (parts.length === 0) {
      return typeof bundle === 'string';
    }
    if (typeof bundle !== 'object' || bundle === null) {
      return false;
    }
    const node = bundle as Record<string, unknown>;
    for (let taken = parts.length; taken > 0; taken--) {
      const joined = parts.slice(0, taken).join('.');
      if (joined in node && resolves(node[joined], parts.slice(taken))) {
        return true;
      }
    }
    return false;
  }

  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return sources(path);
      }
      return /\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
    });
  }

  // Any quoted dotted identifier whose first segment is a real top-level bundle. Keys assembled at runtime from
  // fragments are not caught by this and cannot be — nothing short of rendering every screen would be.
  const roots = new Set(Object.keys(locales[0][1]));
  const used = new Map<string, Set<string>>();

  beforeAll(() => {
    for (const file of sources(APP)) {
      const text = readFileSync(file, 'utf8');
      for (const [, key] of text.matchAll(/['"]([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)+)['"]/g)) {
        if (roots.has(key.split('.')[0])) {
          used.set(key, (used.get(key) ?? new Set()).add(file.slice(APP.length + 1)));
        }
      }
    }
  });

  it.each(locales.map(([name]) => name))('%s defines every key the app uses', locale => {
    const bundle = locales.find(([name]) => name === locale)![1];

    const missing = [...used.entries()]
      .filter(([key]) => !resolves(bundle, key.split('.')))
      .map(([key, files]) => `${key} — used in ${[...files].sort().join(', ')}`);

    expect(missing).toEqual([]);
    // Guards the guard: a regex that stopped matching would pass this vacuously.
    expect(used.size).toBeGreaterThan(100);
  });

  /** The locales are kept in lockstep, so a key added to one and forgotten in the others is a defect on its own. */
  it('defines the same keys in every locale', () => {
    const flatten = (node: unknown, prefix = ''): string[] =>
      typeof node === 'object' && node !== null
        ? Object.entries(node).flatMap(([key, value]) => flatten(value, prefix ? `${prefix}.${key}` : key))
        : [prefix];

    const [first, ...rest] = locales.map(([name, bundle]) => [name, new Set(flatten(bundle))] as const);

    for (const [name, keys] of rest) {
      expect({ [name]: [...keys].filter(key => !first[1].has(key)).sort() }).toEqual({ [name]: [] });
      expect({ [`${first[0]} vs ${name}`]: [...first[1]].filter(key => !keys.has(key)).sort() }).toEqual({
        [`${first[0]} vs ${name}`]: [],
      });
    }
  });
});
