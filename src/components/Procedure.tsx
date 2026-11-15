import { model } from '../data';
import type { Component } from '../data/types';
import { useExplorer } from '../state/store';
import { CommandBlock } from './Operations';
import { useI18n } from '../i18n';

/** "Service procedure" entry point on a customer-replaceable part. */
export function ProcedureStart({ component }: { component: Component }) {
  const start = useExplorer((s) => s.startProcedure);
  const i18n = useI18n();
  const { t } = i18n;
  const procs = (model.topology.procedures ?? []).filter((p) => p.component === component.id);
  if (procs.length === 0) return null;
  const operations = procs.every((p) => p.kind === 'operation');
  return (
    <section>
      <h3>{operations ? t('procedure.operations') : t('procedure.service')}</h3>
      {procs.map((proc) => (
        <button key={proc.id} type="button" className="open-tray proc-start" onClick={() => start(proc.id)}>
          {t('procedure.walkThrough', { title: i18n.procedureTitle(proc.id, proc.title), count: proc.steps.length })}
        </button>
      ))}
    </section>
  );
}

/** The procedure in progress: one step at a time, highlighting the part it is about. */
export function ProcedureBox() {
  const id = useExplorer((s) => s.procedure);
  const step = useExplorer((s) => s.step);
  const goToStep = useExplorer((s) => s.goToStep);
  const stop = useExplorer((s) => s.stopProcedure);
  const i18n = useI18n();
  const { t } = i18n;
  const proc = (model.topology.procedures ?? []).find((p) => p.id === id);
  if (!proc) return null;
  const s = proc.steps[step]!;
  const safety = (model.topology.safety ?? []).filter((n) => n.procedures.includes(proc.id));
  const title = i18n.procedureTitle(proc.id, proc.title);
  return (
    <section className="procedure" aria-label={t('procedure.aria', { title })}>
      <h3>
        {t('procedure.heading', { title, step: step + 1, total: proc.steps.length })}
      </h3>
      <p aria-live="polite">{i18n.procedureStep(proc.id, step, s.text)}</p>
      {s.command && <CommandBlock text={s.command} />}
      {safety.length > 0 && (
        <div className="safety">
          {safety.map((n) => (
            <p key={n.id} className="small">
              <strong>{i18n.safety(n.id, 'title', n.title)}.</strong> {i18n.safety(n.id, 'text', n.text)}
            </p>
          ))}
        </div>
      )}
      <p className="spec-source">
        {t('panel.sourceLabel')}{' '}
        <a href={s.source.url} target="_blank" rel="noopener noreferrer">
          {s.source.section}
        </a>
      </p>
      <div className="procedure-nav">
        <button type="button" disabled={step === 0} onClick={() => goToStep(step - 1)}>
          {t('procedure.previous')}
        </button>
        <button type="button" disabled={step === proc.steps.length - 1} onClick={() => goToStep(step + 1)}>
          {t('procedure.next')}
        </button>
        <button type="button" onClick={stop}>
          {t('procedure.close')}
        </button>
      </div>
      <p className="muted small">
        {proc.kind === 'service' ? t('procedure.exampleService') : t('procedure.exampleOperation')}
      </p>
    </section>
  );
}
