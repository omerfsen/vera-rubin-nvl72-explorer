import { useState } from 'react';
import { model } from '../data';
import type { Component } from '../data/types';

function SourceLink({ url, section }: { url: string; section: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {section}
    </a>
  );
}

/** A command block with a copy button. */
export function CommandBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="command">
      <pre>
        <code>{text}</code>
      </pre>
      <button
        type="button"
        className="copy-button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** Software from chapter 4 that runs on this part. */
export function SoftwareSection({ component }: { component: Component }) {
  const list = (model.topology.software ?? []).filter((s) => s.runsOn.includes(component.id));
  if (list.length === 0) return null;
  return (
    <section>
      <h3>Software</h3>
      <ul className="plain">
        {list.map((s) => (
          <li key={s.id}>
            <strong>{s.name}</strong>
            {s.partOf && <span className="muted"> (part of {model.topology.software?.find((x) => x.id === s.partOf)?.name})</span>}: {s.description}
            {s.note && <div className="note">{s.note}</div>}
            <div className="spec-source">
              Source: <SourceLink url={s.source.url} section={s.source.section} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The guide's BMC commands that act on this part, grouped and copyable. */
export function CommandsSection({ component }: { component: Component }) {
  const list = (model.topology.commands ?? []).filter((c) => c.appliesTo.includes(component.id));
  const notes = model.topology.commandNotes;
  if (list.length === 0) return null;
  const groups = [...new Set(list.map((c) => c.group))];
  return (
    <section>
      <h3>Commands ({list.length})</h3>
      {notes && <p className="note">{notes.usage}</p>}
      {groups.map((g) => (
        <details key={g} className="command-group">
          <summary>
            {g} ({list.filter((c) => c.group === g).length})
          </summary>
          {list
            .filter((c) => c.group === g)
            .map((c) => (
              <div key={c.id} className="command-item">
                <p>
                  <strong>{c.title}.</strong> {c.purpose}
                </p>
                {c.note && <p className="note">{c.note}</p>}
                <CommandBlock text={c.command} />
                <p className="spec-source">
                  Source: <SourceLink url={c.source.url} section={c.source.section} />
                </p>
              </div>
            ))}
        </details>
      ))}
      {notes && <p className="note">{notes.factoryReset}</p>}
    </section>
  );
}

/** Safety notes from chapter 5 for this part. */
export function SafetySection({ component }: { component: Component }) {
  const list = (model.topology.safety ?? []).filter((s) => s.components.includes(component.id));
  if (list.length === 0) return null;
  return (
    <section className="safety">
      <h3>Safety</h3>
      {list.map((s) => (
        <p key={s.id}>
          <strong>{s.title}.</strong> {s.text}{' '}
          <span className="spec-source">
            (<SourceLink url={s.source.url} section={s.source.section} />)
          </span>
        </p>
      ))}
    </section>
  );
}
