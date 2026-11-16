import display from '../../data/display.json';
import type { Model } from './model';
import type { View } from '../state/url';
import { trayKeyOf } from '../state/url';

/**
 * One stop of the "Start here" tour, from data/display.json. Presentation
 * only: what to select and show. The caption is ui.guidedTour.steps.<id>; the
 * facts shown come from the component or network in the topology data.
 */
export interface TourStep {
  id: string;
  view: View;
  /** Selection path, "" for the rack itself. */
  target: string;
  network?: string;
  page?: 'sources';
}

export const TOUR_STEPS: readonly TourStep[] = display.tour.steps as TourStep[];

/** Problems with a tour definition against the data; empty when it is sound. */
export function tourProblems(steps: readonly TourStep[], model: Model): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const s of steps) {
    if (ids.has(s.id)) problems.push(`${s.id}: duplicate id`);
    ids.add(s.id);
    if (model.parsePath(s.target) === null) problems.push(`${s.id}: no such part "${s.target}"`);
    if (s.view === 'tray' && trayKeyOf(s.target, model) === null) problems.push(`${s.id}: "${s.target}" has no interior to open`);
    const first = model.parsePath(s.target)?.[0];
    const rear = first ? model.getComponent(first.id)?.rearSide === true : false;
    if (rear !== (s.view === 'rear') && s.target !== '') problems.push(`${s.id}: a rear part needs the rear view, and only a rear part`);
    if (s.network !== undefined && !model.getNetwork(s.network)) problems.push(`${s.id}: no such network "${s.network}"`);
  }
  return problems;
}

/**
 * Whether the screen still shows a step: its part, view, network and page, with
 * nothing pinned for comparison. False once the viewer has moved on to something else.
 */
export function showsTourStep(
  step: TourStep,
  shown: { view: View; selected: string; network: string; page: string; compare: string },
  model: Model,
): boolean {
  const segments = model.parsePath(step.target);
  const target = segments === null ? '' : model.formatPath(segments);
  const view = step.view === 'tray' && trayKeyOf(target, model) === null ? 'rack' : step.view;
  return (
    shown.selected === target &&
    shown.view === view &&
    shown.network === (step.network ?? '') &&
    shown.page === (step.page ?? '') &&
    shown.compare === ''
  );
}

/** The component a step is about: the last part of its target, or the rack. */
export function tourComponentId(step: TourStep, model: Model): string {
  const segments = model.parsePath(step.target) ?? [];
  return segments.length > 0 ? segments[segments.length - 1]!.id : model.topology.components.find((c) => c.parent === null)!.id;
}
