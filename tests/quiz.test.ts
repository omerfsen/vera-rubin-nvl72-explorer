// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { model } from '../src/data';
import { answerFromSelection, generateQuiz, quizCandidates, QUIZ_LENGTH, seededRandom, type QuizQuestion } from '../src/data/quiz';
import { readUrlState, writeUrlState } from '../src/state/url';
import { useExplorer } from '../src/state/store';

const { topology } = model;
const conflicted = new Set((topology.openQuestions ?? []).filter((q) => q.kind === 'conflict').flatMap((q) => q.components));
const chain = (id: string) => [...model.ancestorsOf(id), id];

/** The answer to a question, worked out again from the raw data. */
function expected(q: QuizQuestion): string {
  switch (q.kind) {
    case 'click':
      return q.component;
    case 'unit':
      return Object.entries(topology.trayLayouts ?? {}).find(([unit, l]) =>
        l.slots.some((s) => s.component === q.component) && chain(q.component).includes(unit),
      )![0];
    case 'count':
      return String(chain(q.component).reduce((n, id) => n * model.getComponent(id)!.count!, 1));
    case 'network':
      return topology.connections.find((c) => c.from === q.component && c.network)!.network!;
  }
}

describe('quiz generator', () => {
  it('gives the same round for the same seed and a different one for another', () => {
    const a = generateQuiz(model, 12345);
    expect(generateQuiz(model, 12345)).toEqual(a);
    expect(generateQuiz(model, 54321)).not.toEqual(a);
    expect(seededRandom(7)()).toBe(seededRandom(7)());
  });

  it('asks ten distinct questions mixing every kind', () => {
    for (const seed of [1, 2, 3, 99, 2 ** 31 - 1]) {
      const qs = generateQuiz(model, seed);
      expect(qs).toHaveLength(QUIZ_LENGTH);
      expect(new Set(qs.map((q) => `${q.kind}|${q.component}`)).size).toBe(QUIZ_LENGTH);
      expect(new Set(qs.map((q) => q.kind))).toEqual(new Set(['click', 'unit', 'count', 'network']));
    }
  });

  it('derives every answer from the data, with a source from NVIDIA', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const q of generateQuiz(model, seed)) {
        expect(q.answer, `${q.kind} ${q.component}`).toBe(expected(q));
        expect(q.source.url).toMatch(/^https:\/\/docs\.nvidia\.com\/dgx\/dgxvr-(user-guide|service-manual)\//);
      }
    }
  });

  it('only asks about stated facts: no null counts, no assumed or disputed fact', () => {
    const c = quizCandidates(model);
    const all = [...c.click, ...c.unit, ...c.count, ...c.network];
    expect(all.length).toBeGreaterThan(20);
    for (const q of all) {
      // A network question rests on the port and its connections; the others on the whole chain of counts.
      for (const id of q.kind === 'network' ? [q.component] : chain(q.component)) {
        const comp = model.getComponent(id)!;
        expect(comp.count, `${q.kind} ${q.component}`).not.toBeNull();
        expect(comp.assumed, `${q.kind} ${q.component}`).not.toBe(true);
        // A conflict over a count does not dispute a port's network; that is an `alternative` connection, checked below.
        if (q.kind !== 'network') expect(conflicted.has(id), `${q.kind} ${q.component}`).toBe(false);
      }
    }
    // Ports whose network is assumed or disputed are never asked.
    for (const q of c.network) {
      const conns = topology.connections.filter((k) => k.from === q.component && k.network);
      expect(conns.every((k) => !k.assumed && !k.alternative)).toBe(true);
    }
    const ids = all.map((q) => q.component);
    expect(ids).not.toContain('hmc');
    expect(ids).not.toContain('ct-port-bf4-left');
    expect(c.network.map((q) => q.component)).not.toContain('ps-mgmt-rj45');
  });

  it('can ask about every network the data puts a port on without dispute, and no other', () => {
    // Worked out again from the raw data: ports, their own connections, nothing assumed or alternative.
    const supported = new Map<string, string[]>();
    const left: Record<string, string[]> = {};
    for (const n of topology.networks) {
      const conns = topology.connections.filter((k) => k.network === n.id);
      const ports = conns.filter((k) => model.getComponent(k.from)?.type === 'port');
      const clean = ports.filter(
        (k) => !topology.connections.some((o) => o.from === k.from && o.network && (o.alternative || o.assumed || o.network !== n.id)),
      );
      if (clean.length > 0) supported.set(n.id, clean.map((k) => k.from).sort());
      else left[n.id] = [...new Set(ports.map((k) => k.from))];
    }
    const asked = new Map<string, string[]>();
    for (const q of quizCandidates(model).network) asked.set(q.answer, [...(asked.get(q.answer) ?? []), q.component].sort());
    expect(asked).toEqual(supported);
    expect([...asked.keys()].sort()).toEqual(['computenet', 'ipminet', 'storagenet']);
    // The rest cannot be answers: dgxnet's only port is the disputed BlueField-4 left port,
    // and the guide connects no port to the other three.
    expect(left).toEqual({ externalnet: [], internalnet: [], dgxnet: ['ct-port-bf4-left'], failovernet: [] });
    // Every supported network turns up as an answer across rounds.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) for (const q of generateQuiz(model, seed)) if (q.kind === 'network') seen.add(q.answer);
    expect(seen).toEqual(new Set(supported.keys()));
  });

  it('does not repeat one network answer through a round', () => {
    const answers = (seed: number, length = QUIZ_LENGTH) =>
      generateQuiz(model, seed, length).filter((q) => q.kind === 'network').map((q) => q.answer);
    expect(answers(4242).length).toBeGreaterThan(1);
    for (let seed = 1; seed <= 200; seed++) {
      const a = answers(seed);
      expect(new Set(a).size, `seed ${seed}: ${a}`).toBe(a.length);
    }
    // Asked to exhaustion, each network comes once before any comes again.
    const all = answers(4242, 1000);
    expect(all).toHaveLength(quizCandidates(model).network.length);
    expect(new Set(all.slice(0, 3)).size).toBe(3);
  });

  it('offers four distinct choices with the answer among them', () => {
    const totals = new Set(quizCandidates(model).totals.map(String));
    const networks = new Set(topology.networks.map((n) => n.id));
    for (let seed = 1; seed <= 40; seed++) {
      for (const q of generateQuiz(model, seed)) {
        if (q.kind !== 'count' && q.kind !== 'network') continue;
        expect(new Set(q.choices).size).toBe(4);
        expect(q.choices.filter((c) => c === q.answer)).toHaveLength(1);
        for (const c of q.choices) expect((q.kind === 'count' ? totals : networks).has(c)).toBe(true);
      }
    }
  });

  it('reads an answer from a selection, ignoring units opened on the way', () => {
    const c = quizCandidates(model);
    const gpu = c.click.find((q) => q.component === 'rubin-gpu')!;
    expect(answerFromSelection(model, gpu, 'compute-tray.3')).toBeNull();
    expect(answerFromSelection(model, gpu, '')).toBeNull();
    expect(answerFromSelection(model, gpu, 'compute-tray.3/rubin-gpu.2')).toBe('rubin-gpu');
    expect(answerFromSelection(model, gpu, 'switch-tray.1')).toBe('switch-tray');
    const unit = c.unit.find((q) => q.component === 'psu')!;
    expect(answerFromSelection(model, unit, 'power-shelf.2')).toBe('power-shelf');
    expect(answerFromSelection(model, unit, 'compute-tray.1/rubin-gpu')).toBe('compute-tray');
    expect(answerFromSelection(model, { ...c.count[0]!, choices: [] }, 'compute-tray.1')).toBeNull();
  });
});

describe('quiz in the store', () => {
  beforeEach(() => useExplorer.setState({ quiz: null, selected: '', view: 'rack' }));

  /** Answer the current question correctly (or not) through the same path the UI uses. */
  function play(correct: boolean) {
    const s = useExplorer.getState();
    const q = s.quiz!.questions[s.quiz!.index]!;
    if (q.kind === 'count' || q.kind === 'network') {
      s.answerQuiz(correct ? q.answer : q.choices.find((c) => c !== q.answer)!);
    } else {
      // Open the unit on the way first: that is navigation, not an answer.
      if (correct && chain(q.answer).length > 2) {
        s.select(pathTo(q.answer).split('/')[0]!);
        expect(useExplorer.getState().quiz!.answer).toBeNull();
      }
      s.select(pathTo(correct ? q.answer : q.answer === 'bus-bar' ? 'tor-switch' : 'bus-bar'));
    }
    return useExplorer.getState().quiz!;
  }

  /** A selection path for a part: inside the first unit that holds it. */
  function pathTo(id: string): string {
    const c = chain(id).filter((x) => x !== 'rack');
    const unit = model.rackUnits.find((u) => u.componentId === c[0]);
    return unit ? [unit.key, ...c.slice(1)].join('/') : c.join('/');
  }

  it('answers by selection and by choice, scores, and ends', () => {
    useExplorer.getState().startQuiz(4242);
    const qs = useExplorer.getState().quiz!.questions;
    expect(qs).toEqual(generateQuiz(model, 4242));
    let expectedScore = 0;
    qs.forEach((q, i) => {
      const correct = i % 3 !== 0;
      const quiz = play(correct);
      expect(quiz.answer, `${i} ${q.kind} ${q.component}`).toEqual({ given: expect.any(String), correct });
      if (correct) expectedScore++;
      expect(quiz.score).toBe(expectedScore);
      // A second answer is ignored.
      useExplorer.getState().answerQuiz(q.answer);
      expect(useExplorer.getState().quiz!.score).toBe(expectedScore);
      useExplorer.getState().nextQuizQuestion();
    });
    const end = useExplorer.getState().quiz!;
    expect(end.done).toBe(true);
    expect(end.score).toBe(expectedScore);
    useExplorer.getState().quitQuiz();
    expect(useExplorer.getState().quiz).toBeNull();
  });

  it('does not move on before an answer, and ignores selection on a choice question', () => {
    useExplorer.getState().startQuiz(4242);
    useExplorer.getState().nextQuizQuestion();
    expect(useExplorer.getState().quiz!.index).toBe(0);
    const s = useExplorer.getState();
    const qs = s.quiz!.questions;
    const i = qs.findIndex((q) => q.kind === 'count' || q.kind === 'network');
    useExplorer.setState({ quiz: { ...s.quiz!, index: i } });
    useExplorer.getState().select('compute-tray.1');
    expect(useExplorer.getState().quiz!.answer).toBeNull();
  });

  it('keeps the seed in the URL so a round can be replayed', () => {
    const state = readUrlState('?quiz=4242&select=compute-tray.1', model);
    expect(state.quiz).toBe(4242);
    expect(readUrlState('?quiz=0', model).quiz).toBeUndefined();
    expect(readUrlState('?quiz=abc', model).quiz).toBeUndefined();
    expect(readUrlState('?quiz=99999999999', model).quiz).toBeUndefined();
    expect(writeUrlState('', { view: 'rack', select: '', list: false, quiz: 4242 })).toBe('?quiz=4242');
    expect(writeUrlState('?quiz=1', { view: 'rack', select: '', list: false })).toBe('');
  });
});
