import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { topology } from '../src/data';
import en from '../data/i18n/en.json';
import tr from '../data/i18n/tr.json';
import zh from '../data/i18n/zh.json';
import { createI18n, format } from '../src/i18n';
import { initialLang, langFromNavigator } from '../src/i18n/lang';
// @ts-expect-error plain JS module shared with the generator script
import { computeContent } from '../scripts/i18n-content.mjs';

/** Every string in a tree, keyed by its path. */
function leaves(tree: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') out.set(path, node);
    else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    else out.set(path, String(node));
  };
  walk(tree, prefix);
  return out;
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe('data/i18n', () => {
  it('en content is up to date with the data (run npm run i18n:en after editing the data)', () => {
    expect(en.content).toEqual(computeContent(topology));
  });

  for (const [lang, file] of [
    ['tr', tr],
    ['zh', zh],
  ] as const) {
    for (const part of ['ui', 'content'] as const) {
      it(`${lang}.json ${part} has exactly the keys of en.json, the same placeholders and no empty string`, () => {
        const base = leaves(en[part]);
        const own = leaves(file[part]);
        expect([...own.keys()].filter((k) => !base.has(k)), 'extra keys').toEqual([]);
        expect([...base.keys()].filter((k) => !own.has(k)), 'missing keys').toEqual([]);
        for (const [k, v] of own) {
          expect(v.trim(), `${lang} ${part}.${k} is empty`).not.toBe('');
          expect(placeholders(v), `${lang} ${part}.${k}`).toEqual(placeholders(base.get(k)!));
        }
      });
    }
  }

  it('en.json has no empty string', () => {
    for (const [k, v] of leaves(en)) expect(v.trim(), k).not.toBe('');
  });

  it('every static t() key used in src exists in en.json', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(`${dir}/${e.name}`);
        else if (/\.tsx?$/.test(e.name)) files.push(`${dir}/${e.name}`);
      }
    };
    walk('src');
    const ui = leaves(en.ui);
    let n = 0;
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9.-]+)'/g)) {
        n++;
        expect(ui.has(m[1]!), `${f}: ${m[1]}`).toBe(true);
      }
    }
    expect(n).toBeGreaterThan(50);
  });

  it('has a name for every component type, link kind, connection kind and document the data uses', () => {
    const ui = leaves(en.ui);
    for (const c of topology.components) expect(ui.has(`types.${c.type}`), c.type).toBe(true);
    for (const l of Object.values(topology.trayLayouts ?? {})) for (const k of l.links ?? []) expect(ui.has(`links.${k.kind}`), k.kind).toBe(true);
    for (const u of topology.rearLayout?.unitConnectors ?? []) expect(ui.has(`links.${u.kind}`), u.kind).toBe(true);
    const rearSide = new Set(topology.components.filter((c) => c.rearSide).map((c) => c.id));
    for (const x of topology.connections) {
      expect(ui.has(`connectionKinds.${x.kind}`), x.kind).toBe(true);
      // The rear view's legend names the kinds of connections to rear parts.
      if (x.to && (rearSide.has(x.from) || rearSide.has(x.to))) expect(ui.has(`links.${x.kind}`), x.kind).toBe(true);
    }
    for (const c of topology.components) for (const r of c.references) expect(ui.has(`docs.${r.document}`)).toBe(true);
    for (const id of new Set(topology.rackLayout.groups.map((g) => g.component))) {
      const type = topology.components.find((c) => c.id === id)!.type;
      expect(ui.has(`unitPlural.${type}`), type).toBe(true);
      expect(ui.has(`per.${type}`), type).toBe(true);
    }
  });

  it('never changes a command: commands keep no text in the language files', () => {
    for (const file of [en, tr, zh]) for (const c of Object.values(file.content.commands)) expect(c).not.toHaveProperty('command');
  });
});

describe('i18n helpers', () => {
  it('fills placeholders and translates content, falling back to English', () => {
    expect(format('{a} of {b}', { a: 1, b: 2 })).toBe('1 of 2');
    const t = createI18n('tr');
    expect(t.name('compute-tray')).toBe(tr.content.components['compute-tray'].name);
    expect(t.segmentLabel({ id: 'compute-tray', index: 7 })).toBe(`${tr.content.components['compute-tray'].name} 7`);
    expect(t.t('count.perRack', { total: 72 })).toContain('72');
    expect(t.t('no.such.key')).toBe('no.such.key');
    // A spec label missing from the file falls back to the English label.
    expect(t.specLabel('Not a label')).toBe('Not a label');
    expect(createI18n('en').name('rubin-gpu')).toBe('Rubin GPU');
  });

  it('picks the first language from the URL, then the saved choice, then the browser', () => {
    expect(initialLang('zh', 'tr', 'tr-TR')).toBe('zh');
    expect(initialLang(undefined, 'tr', 'zh-CN')).toBe('tr');
    expect(initialLang(undefined, null, 'zh-Hans-CN')).toBe('zh');
    expect(initialLang(undefined, null, 'tr')).toBe('tr');
    expect(initialLang(undefined, null, 'de-DE')).toBe('en');
    expect(langFromNavigator(undefined)).toBe('en');
  });
});
