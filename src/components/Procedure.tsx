import { model } from '../data';
import type { Component } from '../data/types';
import { useExplorer } from '../state/store';

/** "Service procedure" entry point on a customer-replaceable part. */
export function ProcedureStart({ component }: { component: Component }) {
  const start = useExplorer((s) => s.startProcedure);
  const proc = (model.topology.procedures ?? []).find((p) => p.component === component.id);
  if (!proc) return null;
  return (
    <section>
      <h3>Service procedure</h3>
      <button type="button" className="open-tray" onClick={() => start(proc.id)}>
        Walk through: {proc.title} ({proc.steps.length} steps)
      </button>
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
  return (
    <section className="procedure" aria-label={`Service procedure: ${proc.title}`}>
      <h3>
        {proc.title} · step {step + 1} of {proc.steps.length}
      </h3>
      <p aria-live="polite">{s.text}</p>
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
      <p className="muted small">Shown on an example unit. Follow the full procedure and safety notes in the service manual.</p>
    </section>
  );
}
