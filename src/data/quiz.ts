// Quiz questions generated from the data. Nothing here is a fact of its own:
// every question and answer is read from the topology through the model, and
// only items whose facts are stated (no null counts, nothing assumed, nothing
// in conflict between NVIDIA's documents) are asked about.
import type { Model } from './model';
import { ROOT_ID } from './model';
import type { Source } from './types';

export type QuizKind = 'click' | 'unit' | 'count' | 'network';

/** Answered by selecting a part in the 3D view or the list. */
export interface SelectQuestion {
  kind: 'click' | 'unit';
  /** The component asked about. */
  component: string;
  /** Component id the selection must name: the part itself, or the unit type holding it. */
  answer: string;
  source: Source;
}

/** Answered by picking one of the choices. */
export interface ChoiceQuestion {
  kind: 'count' | 'network';
  component: string;
  /** A total per rack (as text) or a network id. */
  answer: string;
  /** The answer and its distractors, in the order shown. */
  choices: string[];
  source: Source;
}

export type QuizQuestion = SelectQuestion | ChoiceQuestion;

export const QUIZ_LENGTH = 10;
export const MAX_SEED = 2 ** 31 - 1;
const KINDS: readonly QuizKind[] = ['click', 'unit', 'count', 'network'];

/** mulberry32: a small seeded generator, so a round can be replayed from its seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function isValidSeed(seed: unknown): seed is number {
  return typeof seed === 'number' && Number.isInteger(seed) && seed >= 1 && seed <= MAX_SEED;
}

/** A fresh seed for a new round. */
export function newSeed(): number {
  return 1 + Math.floor(Math.random() * MAX_SEED);
}

/** Everything the quiz may ask, before shuffling. Distractors are filled in by generateQuiz. */
export function quizCandidates(model: Model) {
  const { topology } = model;
  const conflicted = new Set(
    (topology.openQuestions ?? []).filter((q) => q.kind === 'conflict').flatMap((q) => q.components),
  );
  const chain = (id: string) => [...model.ancestorsOf(id), id];
  /** Stated: a count is given, nothing on the way is assumed or in conflict. */
  const stated = (id: string) =>
    chain(id).every((cid) => {
      const c = model.getComponent(cid);
      return c !== undefined && c.count !== null && c.assumed !== true && !conflicted.has(cid);
    });

  const unitTypes = [...new Set(model.rackUnits.map((u) => u.componentId))];
  const layouts = topology.trayLayouts ?? {};
  // Parts drawn inside a unit's layout, with the unit type that holds them.
  const drawn = new Map<string, string>();
  for (const [unit, layout] of Object.entries(layouts)) {
    for (const s of layout.slots) if (chain(s.component).includes(unit)) drawn.set(s.component, unit);
  }
  const rear = model.childrenOf(ROOT_ID).filter((c) => c.rearSide).map((c) => c.id);

  const click: SelectQuestion[] = [...unitTypes, ...rear, ...drawn.keys()]
    .filter((id, i, all) => all.indexOf(id) === i && stated(id))
    .map((id) => ({ kind: 'click', component: id, answer: id, source: model.getComponent(id)!.source }));

  const unit: SelectQuestion[] = [...drawn]
    .filter(([id, u]) => id !== u && stated(id))
    .map(([id, u]) => ({ kind: 'unit', component: id, answer: u, source: layouts[u]!.source }));

  const totals = new Map<string, number>();
  for (const c of topology.components) {
    if (c.id === ROOT_ID || !stated(c.id)) continue;
    const total = model.totalPerRack(c.id);
    if (total !== null) totals.set(c.id, total);
  }
  const count = [...totals].map(([id, total]) => ({
    kind: 'count' as const,
    component: id,
    answer: String(total),
    source: model.getComponent(id)!.source,
  }));

  // A port on exactly one network, read from stated connections, with no conflicting reading.
  const network = topology.components
    .filter((c) => c.type === 'port' && !conflicted.has(c.id) && c.assumed !== true)
    .flatMap((c) => {
      const conns = topology.connections.filter((k) => k.from === c.id && k.network !== undefined);
      if (conns.some((k) => k.alternative || k.assumed)) return [];
      const nets = [...new Set(conns.map((k) => k.network!))];
      if (nets.length !== 1 || !model.getNetwork(nets[0]!)) return [];
      return [{ kind: 'network' as const, component: c.id, answer: nets[0]!, source: conns[0]!.source }];
    });

  return { click, unit, count, network, totals: [...new Set(totals.values())].sort((a, b) => a - b) };
}

/**
 * A round of questions for a seed: the same seed always gives the same round.
 * Kinds take turns in a shuffled order so a round mixes them.
 */
export function generateQuiz(model: Model, seed: number, length = QUIZ_LENGTH): QuizQuestion[] {
  const random = seededRandom(seed);
  const pool = quizCandidates(model);
  const networks = model.topology.networks.map((n) => n.id);
  const queues: Record<QuizKind, (SelectQuestion | Omit<ChoiceQuestion, 'choices'>)[]> = {
    click: shuffle(pool.click, random),
    unit: shuffle(pool.unit, random),
    count: shuffle(pool.count, random),
    network: shuffle(pool.network, random),
  };
  const order = shuffle(KINDS, random);
  const out: QuizQuestion[] = [];
  while (out.length < length && order.some((k) => queues[k].length > 0)) {
    for (const k of order) {
      if (out.length >= length) break;
      const q = queues[k].shift();
      if (!q) continue;
      if (q.kind === 'count') {
        const others = pool.totals.map(String).filter((v) => v !== q.answer);
        out.push({ ...q, choices: shuffle([q.answer, ...shuffle(others, random).slice(0, 3)], random) });
      } else if (q.kind === 'network') {
        const others = networks.filter((n) => n !== q.answer);
        out.push({ ...q, choices: shuffle([q.answer, ...shuffle(others, random).slice(0, 3)], random) });
      } else {
        out.push(q as SelectQuestion);
      }
    }
  }
  return out;
}

/**
 * The answer a selection gives: the part picked (or, for a unit question, the
 * unit type it is in), or null when it is not an answer: nothing selected, a
 * multiple-choice question, or a unit opened on the way to the part asked for.
 */
export function answerFromSelection(model: Model, q: QuizQuestion, path: string): string | null {
  if (q.kind !== 'click' && q.kind !== 'unit') return null;
  const segments = model.parsePath(path);
  if (!segments || segments.length === 0) return null;
  if (q.kind === 'unit') return segments[0]!.id;
  const last = segments[segments.length - 1]!.id;
  if (last !== q.answer && model.ancestorsOf(q.answer).includes(last)) return null;
  return last;
}
