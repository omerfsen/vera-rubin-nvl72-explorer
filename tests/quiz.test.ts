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

  it('only asks about stated facts: no null counts, nothing assumed or in conflict', () => {
    const c = quizCandidates(model);
    const all = [...c.click, ...c.unit, ...c.count, ...c.network];
    expect(all.length).toBeGreaterThan(20);
    for (const q of all) {
      // A network question rests on the port and its connections; the others on the whole chain of counts.
      for (const id of q.kind === 'network' ? [q.component] : chain(q.component)) {
        const comp = model.getComponent(id)!;
        expect(comp.count, `${q.kind} ${q.component}`).not.toBeNull();
        expect(comp.assumed, `${q.kind} ${q.component}`).not.toBe(true);
        expect(conflicted.has(id), `${q.kind} ${q.component}`).toBe(false);
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
