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
  function lookup(bundle: unknown, parts: readonly string[]): string | undefined {
    if (parts.length === 0) {
      return typeof bundle === 'string' ? bundle : undefined;
    }
    if (typeof bundle !== 'object' || bundle === null) {
      return undefined;
    }
    const node = bundle as Record<string, unknown>;
    for (let taken = parts.length; taken > 0; taken--) {
      const joined = parts.slice(0, taken).join('.');
      if (joined in node) {
        const found = lookup(node[joined], parts.slice(taken));
        if (found !== undefined) {
          return found;
        }
      }
    }
    return undefined;
  }

  function resolves(bundle: unknown, parts: readonly string[]): boolean {
    return lookup(bundle, parts) !== undefined;
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

  /**
   * Every placeholder a string declares must be supplied where that string is used — in every locale.
   *
   * <p>This is the check `docs/backlog.md` item 6 asks for, and it exists because the obvious one does not work.
   * `patientPortal.overview.recordedBy` reads `recorded {{ when }} by {{ who }}` and both call sites passed
   * `{ name }`; ngx-translate leaves an unmatched placeholder as literal text, so the caption rendered its own
   * braces to the patient, in all three locales, for as long as the screen has existed. The key EXISTS in all
   * three, so the two tests above pass on it — key parity says nothing about what is inside the string.</p>
   *
   * <p><b>Asserting the rendered text contains no braces would pass vacuously.</b> Page specs import
   * `TranslateModule.forRoot()` with no loader, so the pipe emits the KEY rather than the English value and the
   * literal can never appear under the harness. The comparison has to be between the bundle and the call site,
   * which is what this is.</p>
   *
   * <p>One direction only: a placeholder declared and not passed renders as visible rubbish, which is the defect.
   * A param passed and not declared is dead weight and renders nothing — there is one today
   * (`patientPortal.overview.greeting` is handed `name` by a string that no longer names anybody), and failing on
   * it would be this test insisting on a tidy-up rather than reporting a defect.</p>
   */
  describe('placeholder parity', () => {
    /** `'some.key' | translate: { a: …, b: … }` — the template form. */
    const PIPE = /['"]([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)+)['"]\s*\|\s*translate\s*:\s*(\{[^{}]*\})/g;
    /** `translate.instant('some.key', { a: … })` and its `get`/`stream` siblings — the service form. */
    const SERVICE = /\.(?:instant|get|stream)\(\s*['"]([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)+)['"]\s*,\s*(\{[^{}]*\})/g;

    /** Property names in an object literal, shorthand (`{ count }`) included. */
    function paramsOf(literal: string): Set<string> {
      return new Set([...literal.matchAll(/[{,]\s*([a-zA-Z_$][\w$]*)\s*[:,}]/g)].map(match => match[1]));
    }

    /** `{{ name }}` — ngx-translate's own interpolation, which is not Angular's and is not compiled. */
    function placeholdersOf(value: string): Set<string> {
      return new Set([...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map(match => match[1]));
    }

    /** Every place a key is used WITH params. Keys used without any are none of this test's business. */
    const sites: { key: string; params: Set<string>; file: string }[] = [];

    beforeAll(() => {
      for (const file of sources(APP)) {
        const text = readFileSync(file, 'utf8');
        for (const pattern of [PIPE, SERVICE]) {
          for (const [, key, literal] of text.matchAll(pattern)) {
            if (roots.has(key.split('.')[0])) {
              sites.push({ key, params: paramsOf(literal), file: file.slice(APP.length + 1) });
            }
          }
        }
      }
    });

    it('supplies every placeholder the string declares, in every locale', () => {
      const unsupplied = sites.flatMap(({ key, params, file }) =>
        locales.flatMap(([locale, bundle]) => {
          const value = lookup(bundle, key.split('.'));
          // A key that resolves nowhere is the first test's finding, not this one's.
          if (value === undefined) {
            return [];
          }
          const missing = [...placeholdersOf(value)].filter(name => !params.has(name));
          return missing.length === 0
            ? []
            : [`${key} in ${locale} wants {${missing.join(', ')}} — ${file} passes {${[...params].join(', ')}}`];
        }),
      );

      expect(unsupplied).toEqual([]);
      // Guards the guard: a regex that stopped matching would pass this on an empty set.
      expect(sites.length).toBeGreaterThan(15);
    });
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
