// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import tr from '../data/i18n/tr.json';
import zh from '../data/i18n/zh.json';
import en from '../data/i18n/en.json';
import { model } from '../src/data';
import { search } from '../src/components/search';
import { i18nFor } from '../src/i18n';
import { Breadcrumb } from '../src/components/Breadcrumb';
import { LanguageSwitcher } from '../src/components/LanguageSwitcher';
import { SidePanel } from '../src/components/SidePanel';
import { readUrlState, writeUrlState } from '../src/state/url';
import { syncUrl, useExplorer } from '../src/state/store';

afterEach(() => {
  cleanup();
  useExplorer.setState({ selected: '', lang: 'en' });
  window.history.replaceState(null, '', '/');
});

describe('language switcher', () => {
  it('starts in English', () => {
    expect(useExplorer.getState().lang).toBe('en');
  });

  it('switches the panel and breadcrumb to Turkish and Chinese and keeps the URL in sync', () => {
    window.history.replaceState(null, '', '/?select=compute-tray.7&utm=x');
    useExplorer.setState({ selected: 'compute-tray.7' });
    const stop = syncUrl();
    render(
      <>
        <LanguageSwitcher />
        <Breadcrumb />
        <SidePanel />
      </>,
    );
    const heading = () => screen.getByRole('heading', { level: 2 }).textContent ?? '';
    expect(heading()).toContain('Compute tray 7');
    expect(screen.getByRole('heading', { name: en.ui.panel.whatItIs })).toBeTruthy();
    expect(screen.queryByText(en.ui.language.translated)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'TR' }));
    expect(screen.getByRole('button', { name: 'TR' }).getAttribute('aria-pressed')).toBe('true');
    expect(heading()).toContain(`${tr.content.components['compute-tray'].name} 7`);
    expect(screen.getByRole('heading', { name: tr.ui.panel.whatItIs })).toBeTruthy();
    expect(screen.getByText(tr.content.components['compute-tray'].description)).toBeTruthy();
    expect(screen.getByText(tr.ui.language.translated)).toBeTruthy();
    expect(screen.getByRole('button', { name: tr.ui.breadcrumb.rack })).toBeTruthy();
    expect(window.location.search).toBe('?utm=x&select=compute-tray.7&lang=tr');
    expect(document.documentElement.lang).toBe('tr');

    fireEvent.click(screen.getByRole('button', { name: '中文' }));
    expect(heading()).toContain(`${zh.content.components['compute-tray'].name} 7`);
    expect(screen.getByRole('heading', { name: zh.ui.panel.whatItIs })).toBeTruthy();
    expect(screen.getByText(zh.ui.language.translated)).toBeTruthy();
    expect(window.location.search).toBe('?utm=x&select=compute-tray.7&lang=zh');

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(heading()).toContain('Compute tray 7');
    expect(window.location.search).toBe('?utm=x&select=compute-tray.7');
    expect(document.documentElement.lang).toBe('en');
    stop();
  });
});

describe('language in the URL', () => {
  it('reads tr and zh, ignores anything else, and leaves English out', () => {
    expect(readUrlState('?lang=tr', model).lang).toBe('tr');
    expect(readUrlState('?lang=zh', model).lang).toBe('zh');
    expect(readUrlState('?lang=de', model).lang).toBeUndefined();
    const base = { view: 'rack' as const, select: '', list: false };
    expect(writeUrlState('?a=1&lang=tr', { ...base, lang: 'en' })).toBe('?a=1');
    expect(writeUrlState('?a=1', { ...base, lang: 'zh' })).toBe('?a=1&lang=zh');
  });
});

describe('search in another language', () => {
  it('matches the translated and the English name and labels hits in the chosen language', () => {
    const trName = tr.content.components['power-shelf'].name;
    const t = i18nFor('tr');
    expect(search(model, trName.toLowerCase(), 12, t)[0]?.label).toBe(trName);
    expect(search(model, 'power shelf', 12, t)[0]?.label).toBe(trName);
    const zhName = zh.content.components['power-shelf'].name;
    expect(search(model, zhName, 12, i18nFor('zh'))[0]?.label).toBe(zhName);
  });
});
