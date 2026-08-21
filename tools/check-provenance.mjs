/**
 * New in hc-patient-app — the control described in PROVENANCE.md.
 *
 *     npm run provenance            # → node tools/check-provenance.mjs ../web
 *
 * Decision 3 in patient-mobile.md copies shared TypeScript out of hc-patient-dashboard rather than
 * depending on it. The cost is silent drift, and this script is the whole mitigation: for every row
 * in PROVENANCE.md's lifted-files table it asks the web repo whether that origin file has any
 * commits after the SHA it was lifted at.
 *
 * BE HONEST ABOUT WHAT THIS IS WORTH (PROVENANCE.md, "Limits"):
 *
 *   - CI cannot run it. It needs a sibling ../web checkout the runner does not have. This is a
 *     release-checklist item, not a gate.
 *   - It detects that an origin MOVED, not whether the change matters. A Prettier reflow and a
 *     fixed timezone bug look identical from here.
 *   - It cannot see divergence introduced on this side. A local edit to a lifted file with no
 *     header update is invisible to it.
 *
 * Exit code 1 when any origin has moved, so it can be wired into a release script.
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TABLE = join(ROOT, 'PROVENANCE.md');

/** Origin paths in the table are relative to the web repo's webapp root. */
const WEBAPP_ROOT = 'src/main/webapp';

const webRepo = resolve(ROOT, process.argv[2] ?? '../web');

/**
 * Rows look like:
 *   | theme/_tokens.scss | content/scss/_tokens.scss | 12e418c | two colours darkened for AA |
 * Placeholder and heading rows are skipped: a row only counts when its SHA cell is a hex sha.
 */
function parseRows(markdown) {
  const rows = [];
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|')) {
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map(c => c.trim());
    if (cells.length < 4) {
      continue;
    }
    const [target, origin, sha, divergence] = cells;
    if (!/^[0-9a-f]{7,40}$/.test(sha)) {
      continue;
    }
    rows.push({ target, origin: origin.replace(/^`|`$/g, ''), sha, divergence });
  }
  return rows;
}

/** The directory part of a glob row, e.g. `i18n/en/*.json` → `i18n/en`. */
function dirnameOf(globPath) {
  return globPath.slice(0, globPath.lastIndexOf('/'));
}

async function git(args) {
  const { stdout } = await run('git', ['-C', webRepo, ...args], { maxBuffer: 8 * 1024 * 1024 });
  return stdout.trim();
}

const rows = parseRows(await readFile(TABLE, 'utf8'));

if (rows.length === 0) {
  console.log('No lifted files recorded in PROVENANCE.md yet — nothing to check.');
  process.exit(0);
}

try {
  await git(['rev-parse', '--git-dir']);
} catch {
  console.error(`Not a git repository: ${webRepo}`);
  console.error('Pass the path to a hc-patient-dashboard checkout, e.g. `npm run provenance -- ../web`.');
  process.exit(2);
}

console.log(`Checking ${rows.length} lifted file(s) against ${webRepo}\n`);

const moved = [];
const unknown = [];

for (const row of rows) {
  /**
   * A row may name a single file or a whole directory via a trailing glob — `i18n/en/*.json` covers
   * 48 bundles and listing them individually would be noise. Reduce a glob to its directory: `git
   * log -- <dir>` reports commits touching anything beneath it, which is exactly the question.
   */
  const isGlob = row.origin.includes('*');
  const originPath = `${WEBAPP_ROOT}/${isGlob ? dirnameOf(row.origin) : row.origin}`;

  const exists = await git(['cat-file', '-e', `HEAD:${originPath}`]).then(
    () => true,
    () => false,
  );
  if (!exists) {
    unknown.push({ ...row, reason: `no such ${isGlob ? 'directory' : 'file'} at HEAD: ${originPath}` });
    continue;
  }

  let log;
  try {
    log = await git(['log', '--oneline', `${row.sha}..HEAD`, '--', originPath]);
  } catch (error) {
    unknown.push({ ...row, reason: `cannot resolve ${row.sha}: ${error.message.split('\n')[0]}` });
    continue;
  }

  if (log === '') {
    console.log(`  ok       ${row.target}`);
  } else {
    const commits = log.split('\n');
    console.log(`  MOVED    ${row.target}  (${commits.length} commit(s) since ${row.sha})`);
    moved.push({ ...row, commits });
  }
}

if (unknown.length > 0) {
  console.log('\nCould not check:');
  for (const row of unknown) {
    console.log(`  ${row.target}: ${row.reason}`);
  }
}

if (moved.length > 0) {
  console.log(`\n${moved.length} origin file(s) have moved since they were lifted:\n`);
  for (const row of moved) {
    console.log(`  ${row.target}`);
    console.log(`    origin: ${WEBAPP_ROOT}/${row.origin} @ ${row.sha}`);
    if (row.divergence && row.divergence !== 'none') {
      console.log(`    recorded divergence: ${row.divergence}`);
    }
    for (const commit of row.commits) {
      console.log(`      ${commit}`);
    }
    console.log('');
  }
  console.log('Read each diff, then either port the change and bump the SHA in PROVENANCE.md,');
  console.log('or record in the Divergence column why this copy deliberately does not follow.\n');
  process.exit(1);
}

if (unknown.length > 0) {
  process.exit(1);
}

console.log('\nEvery lifted file is current with its origin.');
