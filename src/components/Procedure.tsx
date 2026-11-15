import { model } from '../data';
import type { Component } from '../data/types';
import { useExplorer } from '../state/store';
import { CommandBlock } from './Operations';

/** "Service procedure" entry point on a customer-replaceable part. */
export function ProcedureStart({ component }: { component: Component }) {
  const start = useExplorer((s) => s.startProcedure);
  const procs = (model.topology.procedures ?? []).filter((p) => p.component === component.id);
  if (procs.length === 0) return null;
  const operations = procs.every((p) => p.kind === 'operation');
  return (
    <section>
      <h3>{operations ? 'Operations' : 'Service procedure'}</h3>
      {procs.map((proc) => (
        <button key={proc.id} type="button" className="open-tray proc-start" onClick={() => start(proc.id)}>
          Walk through: {proc.title} ({proc.steps.length} steps)
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
  const proc = (model.topology.procedures ?? []).find((p) => p.id === id);
  if (!proc) return null;
  const s = proc.steps[step]!;
  const safety = (model.topology.safety ?? []).filter((n) => n.procedures.includes(proc.id));
  return (
    <section className="procedure" aria-label={`Service procedure: ${proc.title}`}>
      <h3>
        {proc.title} · step {step + 1} of {proc.steps.length}
      </h3>
      <p aria-live="polite">{s.text}</p>
      {s.command && <CommandBlock text={s.command} />}
      {safety.length > 0 && step === 0 && (
        <div className="safety">
          {safety.map((n) => (
            <p key={n.id} className="small">
              <strong>{n.title}.</strong> {n.text}
            </p>
          ))}
        </div>
      )}
      <p className="spec-source">
        Source:{' '}
        <a href={s.source.url} target="_blank" rel="noopener noreferrer">
          {s.source.section}
        </a>
      </p>
      <div className="procedure-nav">
        <button type="button" disabled={step === 0} onClick={() => goToStep(step - 1)}>
          ← Previous
        </button>
        <button type="button" disabled={step === proc.steps.length - 1} onClick={() => goToStep(step + 1)}>
          Next →
        </button>
        <button type="button" onClick={stop}>
          Close
        </button>
      </div>
      <p className="muted small">
        Shown on an example unit. Follow the full procedure and safety notes in NVIDIA's{' '}
        {proc.kind === 'service' ? 'service manual' : 'user guide'}.
      </p>
    </section>
  );
}
