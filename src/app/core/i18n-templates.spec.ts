import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TmplAstBoundText, TmplAstElement, TmplAstText, parseTemplate, type TmplAstNode } from '@angular/compiler';

/**
 * No template renders a static text node that is not a translation.
 *
 * <p><b>Read that sentence exactly.</b> It said "no user-facing text" until review, which is an
 * overclaim this check cannot honour: it walks `Text` nodes and the static chunks around each
 * `{{ … }}`, so <em>interpolated</em> copy is invisible to it. `{{ copy().title }}` has no static
 * chunks at all, which means three of the six screens item 22 was opened for — `dead-end`,
 * `fork-failed` and `lock` — could be reverted to English sentences built in TypeScript and this
 * suite would stay green. Attributes (`aria-label`, `placeholder`, `alt`) are unwalked for the same
 * reason; that gap is empty today because every bound label in the app goes through `| translate`,
 * and it is empty by habit rather than by enforcement.</p>
 *
 * <p>What guards the TypeScript half instead is {@link i18n-keys.spec.ts}, which does scan `.ts` for
 * dotted key literals — and the fact that those three pages now return keys rather than sentences.
 * Neither is this check. The honest division is written here so the next reader does not assume a
 * green suite means more than it does.</p>
 *
 * <p>This is the check `docs/backlog.md` item 22 asks for, and the entry is explicit about why the
 * checks already here cannot be it. `i18n-keys.spec.ts` and `tools/merge-i18n.mjs` compare the
 * bundles — against the app, against each other. <b>A string that never became a key is in no bundle
 * to be missing from</b>, so parity is blind to this entire class by construction. `@angular-eslint`'s
 * `i18n` rule is the only other candidate and cannot be enabled here: it wants Angular's own `i18n`
 * attributes so its extractor can find strings, and this app translates through `@ngx-translate`.
 * That rule is switched off in `.eslintrc.json` with the count still beside it, and what it was
 * hiding was `lock.page.html` — which imports `TranslateModule` and used it zero times, greeting a
 * German patient in English on the one screen they meet before they can do anything else.</p>
 *
 * <p><b>Both kinds of template, deliberately.</b> Item 21's own finding was that a rule scoped
 * `files: ["*.html"]` covers files rather than code: twelve components in `shared/ui` — the widget
 * layer on every screen — declare their markup inline, and a check written against one form silently
 * exempts the other. So this walks the `.html` files <em>and</em> the `template:` strings, and asserts
 * a count of each.</p>
 *
 * <p>Parsing is Angular's own `parseTemplate`, not a regex over the markup. It is the compiler the
 * build already runs, so it sees exactly what ships — and, unlike `@angular-eslint` 17's visitor,
 * it descends into `@if`/`@for`/`@switch` bodies and `@empty` blocks, which is where
 * `prefer-control-flow` has actively moved this repository's conditions.</p>
 */
describe('templates carry no untranslated text', () => {
  const APP = join(__dirname, '..');

  /**
   * A string that is legitimately not a translation. Every entry needs a reason; there is no blanket
   * suppression and no pattern that would let one in unnoticed, because the comparison is on the
   * whole trimmed text node rather than on a shape.
   *
   * <p>The list is asserted to be EXACT below — an entry nothing produces any more fails the suite,
   * so it cannot rot into a licence for whatever a later template happens to say.</p>
   */
  const NOT_TRANSLATED = new Map<string, string>([
    [
      'Abofonsa BridgeCare · Health Connect',
      // login.page.html, under the seal. Two product names and a separator. The artwork carries the
      // wordmark but at 120px the strapline around the rim is not readable, so the product is named
      // in text too — and a product name is the same in all three locales.
      'a brand wordmark: two product names, not a sentence',
    ],
    [
      '·',
      // Ten metadata rows across seven screens: `{{ number }} · {{ date }} · {{ clinician }}`. The
      // middot separates two values that are themselves bound; there is no word here to translate.
      'a middot separating two bound values in a metadata row',
    ],
    [
      '%',
      // plans.page.html's progress pill and stack-bar's table cell, both immediately after a bound
      // number. The per-cent sign is the same character in en, de and fr.
      'the per-cent sign following a bound number',
    ],
    // The remaining four are punctuation inside an SVG <title>, which is the tooltip on a chart:
    // `{{ label }} — {{ series }}: {{ value }}` and `{{ label }}: {{ value }} ({{ percent }}%)`.
    // Every word in those tooltips is data. Note the accessible name of each chart is NOT here: it
    // is `[attr.aria-label]="summary()"`, built from translated parts in the component.
    ['—', 'an em dash between two bound values in a chart tooltip'],
    [':', 'a colon between a bound label and its bound value in a chart tooltip'],
    ['(', 'an opening bracket around a bound percentage in a chart tooltip'],
    ['%)', 'a closing bracket after a bound percentage in a chart tooltip'],
    // pager.component.ts writes `&laquo; <span hpmTranslate="…pager.prev">` — the guillemet is the
    // arrow, the word beside it is translated, and the control's accessible name comes from the
    // <nav>'s translated aria-label.
    ['«', 'a guillemet used as the pager’s previous arrow, beside a translated label'],
    ['»', 'a guillemet used as the pager’s next arrow, beside a translated label'],
  ]);

  interface Template {
    readonly file: string;
    readonly source: string;
    readonly inline: boolean;
    /** Lines to add to a parsed line number so it points into the FILE. Zero for an .html template. */
    readonly lineOffset: number;
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

  /** `template: \`…\`` inside a @Component. Anchored to the property so a backtick elsewhere cannot match. */
  const INLINE = /^\s*template:\s*`([\s\S]*?)`,?\s*$/m;

  const files = sources(APP);
  const templates: Template[] = files.flatMap<Template>(file => {
    const text = readFileSync(file, 'utf8');
    if (file.endsWith('.html')) {
      return [{ file, source: text, inline: false, lineOffset: 0 }];
    }
    const found = INLINE.exec(text);
    if (!found) {
      return [];
    }
    // Where the literal's first line sits in the file. `found.index` is the start of the whole
    // `template:` match, so count the newlines before it and one more for the `template: \`` line.
    // `- 1` because lineOf already adds 1 to the parser's 0-indexed line: the literal's own first
    // line IS the `template:` line, so counting it in both places reports every inline hit one line
    // low. Verified by injecting a string at a known file line and reading the number back.
    const lineOffset = text.slice(0, found.index).split('\n').length - 1;
    return [{ file, source: found[1], inline: true, lineOffset }];
  });

  /**
   * The `hpmTranslate` directive assigns to `innerHTML`, so everything inside the element it sits on
   * is replaced at runtime. The English left in the markup there is a placeholder the reader never
   * sees — the JHipster convention, and what 72 of this app's 99 text nodes are. Reporting those
   * would bury the real ones under noise, which is how a checker comes to be switched off.
   *
   * <p>Measured on this branch, 2026-09-09. The first pass at item 22 counted 112 and reported 65
   * defects that were not defects, for want of knowing about this directive.</p>
   */
  function replacesItsContent(element: { attributes?: { name: string }[]; inputs?: { name: string }[] }): boolean {
    const named = (attribute: { name: string }): boolean => attribute.name === 'hpmTranslate';
    return (element.attributes ?? []).some(named) || (element.inputs ?? []).some(named);
  }

  /** Counters, so a walker that stopped walking cannot report success. See the guard test below. */
  let examined = 0;
  let exempted = 0;
  const judged: { file: string; text: string; line: number }[] = [];
  const parseFailures: string[] = [];
  const allowlistUsed = new Set<string>();

  function collect(file: string, value: string, line: number, insideDirective: boolean): void {
    const text = value.replace(/\s+/g, ' ').trim();
    if (text === '') {
      return;
    }
    examined++;
    if (insideDirective) {
      exempted++;
      return;
    }
    judged.push({ file: file.slice(APP.length + 1), text, line });
  }

  /**
   * The reported line, corrected for inline templates.
   *
   * <p>`parseTemplate` is handed the EXTRACTED string, so its line numbers are relative to the
   * template literal rather than to the file. Reporting them raw pointed at a doc comment for every
   * one of the twelve `shared/ui` components — the components whose coverage is this spec's headline
   * claim. Item 21's finding, reproduced one layer down: covering the code is not the same as
   * reporting it usefully.</p>
   */
  function lineOf(node: TmplAstNode, template: Template): number {
    return node.sourceSpan.start.line + 1 + template.lineOffset;
  }

  function walk(nodes: readonly TmplAstNode[] | undefined, file: string, insideDirective: boolean, template: Template): void {
    for (const node of nodes ?? []) {
      // `instanceof`, not `constructor.name`. Under a minified @angular/compiler those names become
      // single letters, the walker would match nothing, and the main assertion — expect([]).toEqual([])
      // — would pass while seeing zero nodes. The counters below would catch it, but a check should
      // not depend on its own guard for correctness. (Jest resolves the unminified fesm2022 build
      // today, so this is hardening, not a live bug.)
      const line = lineOf(node, template);

      if (node instanceof TmplAstText) {
        collect(file, node.value, line, insideDirective);
      } else if (node instanceof TmplAstBoundText) {
        // The static chunks around each `{{ … }}`. `{{ 'a.key' | translate }}` has none.
        const strings = (node.value as unknown as { ast?: { strings?: string[] } }).ast?.strings ?? [];
        for (const chunk of strings) {
          collect(file, chunk, line, insideDirective);
        }
      }

      // The exemption covers the element's OWN text, not its whole subtree. Both are equivalent today
      // — measured: 85 hpmTranslate elements, none with an element or block child — but the narrow
      // form has the better failure mode. Markup nested under hpmTranslate never renders at all, since
      // the directive overwrites innerHTML and takes the embedded-view anchors with it; the wide form
      // hides that silently, the narrow form reports the string and leads you to the dead markup.
      const replaced = node instanceof TmplAstElement && replacesItsContent(node as never);
      // Every container the parser can produce, blocks included — `@if` branches, `@for` bodies and
      // their `@empty`, `@switch` cases, `@defer` and its placeholder/loading/error blocks.
      for (const key of ['children', 'branches', 'cases', 'body', 'empty', 'loading', 'placeholder', 'error'] as const) {
        const child: unknown = (node as unknown as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
          walk(child as TmplAstNode[], file, insideDirective || replaced, template);
        } else if (child !== null && typeof child === 'object' && 'children' in child) {
          walk([child as unknown as TmplAstNode], file, insideDirective || replaced, template);
        }
      }
    }
  }

  beforeAll(() => {
    for (const template of templates) {
      const parsed = parseTemplate(template.source, template.file, { preserveWhitespaces: false });
      if (parsed.errors?.length) {
        // A template that does not parse contributes no nodes, which would look like a clean one.
        parseFailures.push(`${template.file}: ${parsed.errors.map(error => error.msg).join('; ')}`);
        continue;
      }
      walk(parsed.nodes, template.file, false, template);
    }
    for (const { text } of judged) {
      if (NOT_TRANSLATED.has(text)) {
        allowlistUsed.add(text);
      }
    }
  });

  it('renders no user-facing text that is not a translation', () => {
    const untranslated = judged
      .filter(({ text }) => !NOT_TRANSLATED.has(text))
      .map(({ file, line, text }) => `${file}:${line} — ${JSON.stringify(text)}`);

    expect(untranslated).toEqual([]);
  });

  /**
   * Guards the guard, in every direction a silent break could take it — the habit `docs/CLAUDE.md`
   * records after six checks that reported success without having looked.
   *
   * <p>A walker that found no templates, an extraction regex that stopped matching, a descent that
   * stopped descending, or a `replacesItsContent` that started answering `true` for everything would
   * each leave the test above asserting `[] === []` and passing. Each has a counter here, and each
   * counter is a floor a real regression has to cross rather than a snapshot of today's number.</p>
   */
  it('actually walked the templates it claims to have walked', () => {
    // Nothing was skipped for being unparseable.
    expect(parseFailures).toEqual([]);

    // 41 templates on the branch that added this: 29 `.html` and 12 inline.
    expect(templates.length).toBeGreaterThan(35);
    expect(templates.filter(template => template.inline).length).toBeGreaterThanOrEqual(12);
    expect(templates.filter(template => !template.inline).length).toBeGreaterThan(25);

    // The inline extractor found every component that declares one. Counted independently of the
    // regex that does the extracting, so a regex that stopped matching fails here rather than
    // quietly exempting the widget layer — item 21's finding, in the place it would be repeated.
    const declaring = files.filter(file => file.endsWith('.ts') && readFileSync(file, 'utf8').includes('template: `'));
    expect(
      templates
        .filter(template => template.inline)
        .map(template => template.file)
        .sort(),
    ).toEqual(declaring.sort());

    // Non-empty text nodes seen at all: 99 as this landed. A descent that stopped at the first
    // block boundary — which is where @angular-eslint 17 stops — would collapse this.
    expect(examined).toBeGreaterThan(80);

    // Of those, the 72 inside an `hpmTranslate` element, whose English is a placeholder the reader
    // never sees. If `replacesItsContent` started answering true for everything this would swallow
    // the lot and the test above would be comparing nothing, so the remainder has a floor too: 27
    // text nodes are actually judged against the allowlist.
    expect(exempted).toBeGreaterThan(55);
    expect(judged.length).toBeGreaterThan(20);
  });

  /** The allowlist stays honest: every entry is something a template still produces. */
  it('has nothing on the allowlist that no template produces any more', () => {
    expect([...NOT_TRANSLATED.keys()].filter(text => !allowlistUsed.has(text))).toEqual([]);

    // And every entry carries a reason, which is the only thing making it reviewable.
    expect([...NOT_TRANSLATED.entries()].filter(([, reason]) => reason.trim().length < 10)).toEqual([]);
  });
});
