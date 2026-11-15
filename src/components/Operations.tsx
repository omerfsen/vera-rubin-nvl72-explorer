import { useState } from 'react';
import { model } from '../data';
import type { Component } from '../data/types';
import { useI18n } from '../i18n';

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
  const { t } = useI18n();
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
        {copied ? t('ops.copied') : t('ops.copy')}
      </button>
    </div>
  );
}

/** Software from chapter 4 that runs on this part. */
export function SoftwareSection({ component }: { component: Component }) {
  const list = (model.topology.software ?? []).filter((s) => s.runsOn.includes(component.id));
  const i18n = useI18n();
  const { t } = i18n;
  if (list.length === 0) return null;
  return (
    <section>
      <h3>{t('ops.software')}</h3>
      <ul className="plain">
        {list.map((s) => (
          <li key={s.id}>
            <strong>{s.name}</strong>
            {s.partOf && (
              <span className="muted">{t('ops.partOf', { name: model.topology.software?.find((x) => x.id === s.partOf)?.name ?? s.partOf })}</span>
            )}
            : {i18n.software(s.id, 'description', s.description)}
            {s.note && <div className="note">{i18n.software(s.id, 'note', s.note)}</div>}
            <div className="spec-source">
              {t('panel.sourceLabel')} <SourceLink url={s.source.url} section={s.source.section} />
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
  const i18n = useI18n();
  const { t } = i18n;
  if (list.length === 0) return null;
  // Grouped by the English group name, shown translated.
  const groups = [...new Set(list.map((c) => c.group))];
  const groupName = (g: string) => {
    const first = list.find((c) => c.group === g)!;
    return i18n.command(first.id, 'group', g);
  };
  return (
    <section>
      <h3>{t('ops.commands', { count: list.length })}</h3>
      {notes && <p className="note">{i18n.commandNote('usage', notes.usage)}</p>}
      {groups.map((g) => (
        <details key={g} className="command-group">
          <summary>
            {groupName(g)} ({list.filter((c) => c.group === g).length})
          </summary>
          {list
            .filter((c) => c.group === g)
            .map((c) => (
              <div key={c.id} className="command-item">
                <p>
                  <strong>{i18n.command(c.id, 'title', c.title)}.</strong> {i18n.command(c.id, 'purpose', c.purpose)}
                </p>
                {c.note && <p className="note">{i18n.command(c.id, 'note', c.note)}</p>}
                <CommandBlock text={c.command} />
                <p className="spec-source">
                  {t('panel.sourceLabel')} <SourceLink url={c.source.url} section={c.source.section} />
                </p>
              </div>
            ))}
        </details>
      ))}
      {notes && <p className="note">{i18n.commandNote('factoryReset', notes.factoryReset)}</p>}
    </section>
  );
}

/** Safety notes from chapter 5 for this part. */
export function SafetySection({ component }: { component: Component }) {
  const list = (model.topology.safety ?? []).filter((s) => s.components.includes(component.id));
  const i18n = useI18n();
  if (list.length === 0) return null;
  return (
    <section className="safety">
      <h3>{i18n.t('ops.safety')}</h3>
      {list.map((s) => (
        <p key={s.id}>
          <strong>{i18n.safety(s.id, 'title', s.title)}.</strong> {i18n.safety(s.id, 'text', s.text)}{' '}
          <span className="spec-source">
            (<SourceLink url={s.source.url} section={s.source.section} />)
          </span>
        </p>
      ))}
    </section>
  );
}
