// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { model } from '../src/data';
import { TOUR_STEPS, tourComponentId, tourProblems, type TourStep } from '../src/data/tour';
import { syncUrl, TOUR_HOME, useExplorer } from '../src/state/store';
import { TourBox, TourButton } from '../src/components/Tour';
import en from '../data/i18n/en.json';

const RESET = { tour: null, selected: '', view: 'rack' as const, procedure: '', step: 0, page: '', network: '', compare: '', quiz: null };

afterEach(() => {
  cleanup();
  useExplorer.setState(RESET);
});

const index = (id: string) => TOUR_STEPS.findIndex((s) => s.id === id);

describe('tour definition', () => {
  it('has 8 to 12 steps, every target, view and network valid against the data', () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(8);
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(12);
    expect(tourProblems(TOUR_STEPS, model)).toEqual([]);
  });

  it('flags a missing part, a closed unit, a front part in the rear view and an unknown network', () => {
    const bad: TourStep[] = [
      { id: 'a', view: 'rack', target: 'no-such-part' },
      { id: 'b', view: 'tray', target: 'bus-bar' },
      { id: 'c', view: 'rear', target: 'compute-tray.1' },
      { id: 'd', view: 'rack', target: '', network: 'nonet' },
      { id: 'd', view: 'rack', target: '' },
    ];
    expect(tourProblems(bad, model)).toHaveLength(6);
  });

  it('has a caption for every step', () => {
    const captions = en.ui.guidedTour.steps as Record<string, string>;
    for (const s of TOUR_STEPS) expect(captions[s.id], s.id).toBeTruthy();
    expect(Object.keys(captions).sort()).toEqual(TOUR_STEPS.map((s) => s.id).sort());
  });

  it('covers the parts the tour promises: trays, GPU, CPU, power, rear, a network and the sources page', () => {
    const types = TOUR_STEPS.map((s) => model.getComponent(tourComponentId(s, model))?.type);
    for (const t of ['rack', 'compute-tray', 'gpu', 'cpu', 'switch-tray', 'power-shelf', 'cable-cartridge', 'bus-bar']) expect(types).toContain(t);
    expect(TOUR_STEPS.some((s) => s.view === 'tray')).toBe(true);
    expect(TOUR_STEPS.some((s) => s.view === 'rear')).toBe(true);
    expect(TOUR_STEPS.some((s) => s.network)).toBe(true);
    expect(TOUR_STEPS.at(-1)?.page).toBe('sources');
  });
});

describe('tour in the store', () => {
  it('applies each step: selection, view, network and page', () => {
    useExplorer.getState().startTour();
    TOUR_STEPS.forEach((s, i) => {
      useExplorer.getState().goToTourStep(i);
      const st = useExplorer.getState();
      expect(st.tour?.index).toBe(i);
      expect(st.selected, s.id).toBe(model.formatPath(model.parsePath(s.target)!));
      expect(st.view, s.id).toBe(s.view);
      expect(st.network, s.id).toBe(s.network ?? '');
      expect(st.page, s.id).toBe(s.page ?? '');
    });
  });

  it('opens the compute tray, then shows a GPU inside it', () => {
    useExplorer.getState().startTour();
    useExplorer.getState().goToTourStep(index('openTray'));
    expect(useExplorer.getState()).toMatchObject({ view: 'tray', selected: 'compute-tray.1' });
    useExplorer.getState().goToTourStep(index('gpu'));
    expect(useExplorer.getState()).toMatchObject({ view: 'tray', selected: 'compute-tray.1/rubin-gpu.1' });
  });

  it('keeps Back and Next inside the first and last step', () => {
    const s = useExplorer.getState();
    s.startTour();
    s.goToTourStep(-3);
    expect(useExplorer.getState().tour?.index).toBe(0);
    s.goToTourStep(999);
    expect(useExplorer.getState().tour?.index).toBe(TOUR_STEPS.length - 1);
  });

  it('puts back the earlier view on exit', () => {
    useExplorer.setState({ selected: 'switch-tray.4', view: 'tray', network: 'dgxnet' });
    useExplorer.getState().startTour();
    useExplorer.getState().goToTourStep(index('cableCartridge'));
    expect(useExplorer.getState().view).toBe('rear');
    useExplorer.getState().stopTour();
    expect(useExplorer.getState()).toMatchObject({ tour: null, selected: 'switch-tray.4', view: 'tray', network: 'dgxnet', page: '' });
  });

  it('ends when a walkthrough or a quiz starts', () => {
    const proc = model.topology.procedures![0]!;
    useExplorer.getState().startTour();
    useExplorer.getState().startProcedure(proc.id);
    expect(useExplorer.getState().tour).toBeNull();
    useExplorer.getState().startTour();
    expect(useExplorer.getState().procedure).toBe('');
    useExplorer.getState().startQuiz(42);
    expect(useExplorer.getState().tour).toBeNull();
  });
});

describe('tour in the URL', () => {
  const tourParam = () => new URLSearchParams(window.location.search).get('tour');

  it('writes the step, follows it and drops the key when the tour ends', () => {
    window.history.replaceState(null, '', '/?utm=x');
    const stop = syncUrl();
    expect(tourParam()).toBeNull();
    useExplorer.getState().startTour();
    expect(tourParam()).toBe('1');
    useExplorer.getState().goToTourStep(index('openTray'));
    expect(window.location.search).toBe(`?utm=x&view=tray&select=compute-tray.1&tour=${index('openTray') + 1}`);
    useExplorer.getState().stopTour();
    expect(window.location.search).toBe('?utm=x');
    useExplorer.getState().startTour();
    useExplorer.getState().startQuiz(42);
    expect(tourParam()).toBeNull();
    stop();
    window.history.replaceState(null, '', '/');
  });

  it('leaves the step out of the link once the viewer moves off it, and puts it back on return', () => {
    window.history.replaceState(null, '', '/');
    const stop = syncUrl();
    const at = index('computeTray');
    const s = useExplorer.getState();
    s.startTour(at);
    expect(tourParam()).toBe(String(at + 1));
    s.select('power-shelf.2');
    expect(window.location.search).toBe('?select=power-shelf.2');
    expect(useExplorer.getState().tour?.index).toBe(at);
    s.goToTourStep(at);
    expect(tourParam()).toBe(String(at + 1));
    for (const off of [{ network: 'dgxnet' }, { page: 'sources' }, { compare: 'power-shelf.1' }, { view: 'rear' as const }]) {
      useExplorer.setState(off);
      expect(tourParam(), JSON.stringify(off)).toBeNull();
      useExplorer.setState({ compare: '' });
      s.goToTourStep(at);
      expect(tourParam()).toBe(String(at + 1));
    }
    // Every step counts as on screen right after it is shown.
    TOUR_STEPS.forEach((_, i) => {
      s.goToTourStep(i);
      expect(tourParam(), String(i)).toBe(String(i + 1));
    });
    s.stopTour();
    stop();
    window.history.replaceState(null, '', '/');
  });

  it('a shared link starts at its step and exits to the plain rack', () => {
    useExplorer.setState({ selected: 'compute-tray.1', view: 'tray' });
    useExplorer.getState().startTour(index('gpu'), TOUR_HOME);
    expect(useExplorer.getState()).toMatchObject({ view: 'tray', selected: 'compute-tray.1/rubin-gpu.1' });
    expect(useExplorer.getState().tour?.index).toBe(index('gpu'));
    useExplorer.getState().stopTour();
    expect(useExplorer.getState()).toMatchObject({ tour: null, selected: '', view: 'rack', network: '', page: '' });
  });

  it('starts from the address bar when the page loads, but not in an embed', async () => {
    const load = async (search: string) => {
      window.history.replaceState(null, '', `/${search}`);
      vi.resetModules();
      return (await import('../src/state/store')).useExplorer.getState();
    };
    const at = await load('?tour=3');
    expect(at.tour).toEqual({ index: 2, restore: TOUR_HOME });
    expect(at).toMatchObject({ view: TOUR_STEPS[2]!.view, selected: TOUR_STEPS[2]!.target });
    expect((await load('?tour=99')).tour).toBeNull();
    expect((await load('?tour=3&embed=1')).tour).toBeNull();
    // The step wins over a view and selection in the same link.
    expect(await load('?select=power-shelf.2&tour=2')).toMatchObject({ selected: TOUR_STEPS[1]!.target });
    window.history.replaceState(null, '', '/');
  });
});

describe('tour card', () => {
  it('starts from the top bar and shows the step, caption and the part from the data', () => {
    render(
      <>
        <TourButton />
        <TourBox />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start here' }));
    expect(screen.getByText(`Start here · step 1 of ${TOUR_STEPS.length}`)).toBeTruthy();
    act(() => useExplorer.getState().goToTourStep(index('gpu')));
    const gpu = model.getComponent('rubin-gpu')!;
    expect(screen.getByText(en.ui.guidedTour.steps.gpu)).toBeTruthy();
    expect(screen.getByText(`${model.totalPerRack('rubin-gpu')} per rack (computed)`)).toBeTruthy();
    expect(screen.getByRole('link', { name: gpu.source.section }).getAttribute('href')).toBe(gpu.source.url);
  });

  it('moves with the arrow keys and Enter, and Escape ends it', () => {
    render(<TourBox />);
    act(() => useExplorer.getState().startTour());
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(useExplorer.getState().tour?.index).toBe(1);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(useExplorer.getState().tour?.index).toBe(2);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(useExplorer.getState().tour?.index).toBe(1);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(useExplorer.getState().tour).toBeNull();
    expect(useExplorer.getState().selected).toBe('');
  });

  it('turns the last Next into Finish, which ends the tour', () => {
    render(<TourBox />);
    act(() => {
      useExplorer.getState().startTour();
      useExplorer.getState().goToTourStep(TOUR_STEPS.length - 1);
    });
    expect((screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(useExplorer.getState().tour).toBeNull();
    expect(useExplorer.getState().page).toBe('');
  });
});
