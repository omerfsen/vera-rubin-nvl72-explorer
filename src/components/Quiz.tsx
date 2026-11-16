import { useEffect, useRef } from 'react';
import { model } from '../data';
import { QUIZ_LENGTH, type QuizQuestion } from '../data/quiz';
import { useExplorer } from '../state/store';
import { useI18n, type I18n } from '../i18n';

/** "Quiz" in the top bar: starts a new round. */
export function QuizButton() {
  const quiz = useExplorer((s) => s.quiz);
  const startQuiz = useExplorer((s) => s.startQuiz);
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="toggle"
      aria-pressed={quiz !== null}
      title={t('quiz.startHint', { count: QUIZ_LENGTH })}
      onClick={() => startQuiz()}
    >
      {t('quiz.start')}
    </button>
  );
}

/** An answer as shown: a part or unit name, a number, or a network. */
function answerLabel(q: QuizQuestion, value: string, i18n: I18n): string {
  if (q.kind === 'count') return value;
  if (q.kind === 'network') {
    const n = model.getNetwork(value);
    return n ? i18n.t('panel.networkItem', { number: n.number, name: n.name }) : value;
  }
  return i18n.name(value);
}

function prompt(q: QuizQuestion, i18n: I18n): string {
  return i18n.t(`quiz.${q.kind}`, { name: i18n.name(q.component) });
}

/** The quiz in progress, at the top of the details panel. */
export function QuizBox() {
  const quiz = useExplorer((s) => s.quiz);
  const answerQuiz = useExplorer((s) => s.answerQuiz);
  const next = useExplorer((s) => s.nextQuizQuestion);
  const quit = useExplorer((s) => s.quitQuiz);
  const startQuiz = useExplorer((s) => s.startQuiz);
  const i18n = useI18n();
  const { t } = i18n;
  const nextRef = useRef<HTMLButtonElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);
  const answered = quiz?.answer !== null && quiz?.answer !== undefined;
  const done = quiz?.done ?? false;

  // Keyboard users land on the next step once a question is answered or the round ends.
  useEffect(() => {
    if (answered) nextRef.current?.focus({ preventScroll: true });
  }, [answered, quiz?.index]);
  useEffect(() => {
    if (done) againRef.current?.focus({ preventScroll: true });
  }, [done]);

  if (!quiz) return null;
  const total = quiz.questions.length;

  if (quiz.done) {
    return (
      <section className="quiz" aria-label={t('quiz.aria')}>
        <h3>{t('quiz.done')}</h3>
        <p className="quiz-final" aria-live="polite">
          {t('quiz.final', { score: quiz.score, total })}
        </p>
        <div className="procedure-nav">
          <button type="button" ref={againRef} onClick={() => startQuiz()}>
            {t('quiz.again')}
          </button>
          <button type="button" onClick={quit}>
            {t('quiz.close')}
          </button>
        </div>
      </section>
    );
  }

  const q = quiz.questions[quiz.index]!;
  const answer = quiz.answer;
  const last = quiz.index === total - 1;
  return (
    <section className="quiz" aria-label={t('quiz.aria')}>
      <h3>{t('quiz.heading', { current: quiz.index + 1, total })}</h3>
      <p className="quiz-score">{t('quiz.score', { score: quiz.score, total })}</p>
      <p className="quiz-question" aria-live="polite">
        {prompt(q, i18n)}
      </p>
      {q.kind === 'count' || q.kind === 'network' ? (
        <div className="quiz-choices" role="group" aria-label={t('quiz.choices')}>
          {q.choices.map((c) => {
            const state = !answer ? '' : c === q.answer ? ' right' : c === answer.given ? ' wrong' : '';
            return (
              <button
                key={c}
                type="button"
                className={`quiz-choice${state}`}
                aria-pressed={answer ? c === answer.given : undefined}
                disabled={answer !== null}
                onClick={() => answerQuiz(c)}
              >
                {answerLabel(q, c, i18n)}
              </button>
            );
          })}
        </div>
      ) : (
        !answer && <p className="muted small">{t('quiz.selectHint')}</p>
      )}
      {answer && (
        <div className={answer.correct ? 'quiz-feedback right' : 'quiz-feedback wrong'} role="status">
          <p>{answer.correct ? t('quiz.correct') : t('quiz.wrong', { answer: answerLabel(q, q.answer, i18n) })}</p>
          <p className="spec-source">
            {t('panel.sourceLabel')}{' '}
            <a href={q.source.url} target="_blank" rel="noopener noreferrer">
              {q.source.section}
            </a>
          </p>
        </div>
      )}
      <div className="procedure-nav">
        {answer && (
          <button type="button" ref={nextRef} onClick={next}>
            {last ? t('quiz.finish') : t('quiz.next')}
          </button>
        )}
        <button type="button" onClick={quit}>
          {t('quiz.quit')}
        </button>
      </div>
      <p className="muted small">{t('quiz.round', { seed: quiz.seed })}</p>
    </section>
  );
}
