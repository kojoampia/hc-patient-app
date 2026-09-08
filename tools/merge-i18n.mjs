/**
 * New in hc-patient-app — replaces merge-jsons-webpack-plugin (patient-mobile.md §7.7.1).
 *
 * The web repo merges its per-feature i18n bundles inside webpack. There is no webpack here — the
 * build is @angular/build:application (esbuild) — so the merge is a build step instead, run by the
 * `i18n` npm script and hooked onto prestart/prebuild/pretest.
 *
 * It does three things:
 *
 *   1. Deep-merges src/i18n/<locale>/*.json into src/assets/i18n/<locale>.json.
 *   2. Writes src/environments/i18n-hash.ts, the cache-buster translation.config.ts appends to
 *      each request. Content-derived, so it changes exactly when a translation changes.
 *   3. FAILS THE BUILD when the three locales do not have identical key sets.
 *
 * (3) is the reason this file is more than twenty lines, and it is a check the web does not have.
 * A key present in en and missing in de does not fail anything upstream: ngx-translate's
 * MissingTranslationHandlerImpl renders the literal string `translation-not-found[some.key]` into
 * the page, in German, at runtime, for a user nobody on the team is testing as. The counts were
 * 1199 / 1198 / 1189 when this app was scaffolded, so the gap is real and pre-existing — closing it
 * while the app is one page is the cheapest it will ever be.
 *
 * Both generated outputs are gitignored. They are build artefacts; src/i18n/ is the source.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src', 'i18n');
const OUT = join(ROOT, 'src', 'assets', 'i18n');
const HASH_FILE = join(ROOT, 'src', 'environments', 'i18n-hash.ts');

/**
 * Kept in step with the `translation.config.ts` locale list and the language selector. Adding a
 * locale here without adding its directory is a hard failure, which is the intent.
 */
const LOCALES = ['en', 'fr', 'de'];

/** Deep-merge, with a hard error on a genuine conflict rather than a silent last-one-wins. */
function merge(target, source, file, path = []) {
  for (const [key, value] of Object.entries(source)) {
    const here = [...path, key];
    const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

    if (isObject(value) && isObject(target[key])) {
      merge(target[key], value, file, here);
    } else if (key in target) {
      throw new Error(`duplicate i18n key "${here.join('.')}" redefined by ${file}`);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/** Every leaf path in the bundle, dot-joined — the unit the equality check compares. */
function leafKeys(object, path = [], into = new Set()) {
  for (const [key, value] of Object.entries(object)) {
    const here = [...path, key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      leafKeys(value, here, into);
    } else {
      into.add(here.join('.'));
    }
  }
  return into;
}

async function loadLocale(locale) {
  const dir = join(SRC, locale);
  let files;
  try {
    files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort();
  } catch {
    throw new Error(`missing i18n directory for locale "${locale}" (expected ${dir})`);
  }
  if (files.length === 0) {
    throw new Error(`no .json bundles under ${dir}`);
  }

  const merged = {};
  for (const file of files) {
    const raw = await readFile(join(dir, file), 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      throw new Error(`${locale}/${file} is not valid JSON: ${cause.message}`);
    }
    merge(merged, parsed, `${locale}/${file}`, []);
  }
  return merged;
}

/** Sort keys recursively so the hash depends on content and never on directory-read order. */
function sortDeep(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(k => [k, sortDeep(value[k])]),
  );
}

const bundles = new Map();
for (const locale of LOCALES) {
  bundles.set(locale, await loadLocale(locale));
}

// ------------------------------------------------------------------ the gate
const keysByLocale = new Map([...bundles].map(([locale, bundle]) => [locale, leafKeys(bundle)]));
const union = new Set([...keysByLocale.values()].flatMap(set => [...set]));

const problems = [];
for (const [locale, keys] of keysByLocale) {
  const missing = [...union].filter(k => !keys.has(k)).sort();
  if (missing.length > 0) {
    problems.push({ locale, missing });
  }
}

for (const [locale, keys] of keysByLocale) {
  console.log(`  ${locale}: ${keys.size} keys from ${(await readdir(join(SRC, locale))).length} files`);
}

if (problems.length > 0) {
  console.error(`\ni18n key sets are not equal across ${LOCALES.join(', ')} — ${union.size} keys in the union.\n`);
  for (const { locale, missing } of problems) {
    console.error(`  ${locale} is missing ${missing.length}:`);
    for (const key of missing.slice(0, 40)) {
      console.error(`    ${key}`);
    }
    if (missing.length > 40) {
      console.error(`    … and ${missing.length - 40} more`);
    }
    console.error('');
  }
  console.error('A missing key renders as translation-not-found[key] in that language, at runtime,');
  console.error('with nothing else failing. Add the key to the locale above — see patient-mobile.md §7.7.\n');
  process.exit(1);
}

// ------------------------------------------------------------------ emit
await mkdir(OUT, { recursive: true });
const hash = createHash('sha256');
for (const locale of LOCALES) {
  const sorted = sortDeep(bundles.get(locale));
  const json = JSON.stringify(sorted);
  hash.update(`${locale}:${json}`);
  await writeFile(join(OUT, `${locale}.json`), `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}
const digest = hash.digest('hex').slice(0, 16);

await mkdir(dirname(HASH_FILE), { recursive: true });
await writeFile(
  HASH_FILE,
  `/* GENERATED by tools/merge-i18n.mjs — do not edit, do not commit (see .gitignore). */\n` + `export const I18N_HASH = '${digest}';\n`,
  'utf8',
);

console.log(`  merged ${union.size} keys per locale -> src/assets/i18n/{${LOCALES.join(',')}}.json`);
console.log(`  I18N_HASH ${digest}`);
