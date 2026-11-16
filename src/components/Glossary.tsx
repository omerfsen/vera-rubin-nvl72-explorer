import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { model } from '../data';
import { splitGlossary } from '../data/glossary';
import type { GlossaryTerm } from '../data/types';
import { useI18n } from '../i18n';

const entries = (): readonly GlossaryTerm[] => model.topology.glossary ?? [];

/** One glossary term in the panel text: a button that opens a small popover with the definition and its source. */
export function GlossaryTermButton({ entry, text }: { entry: GlossaryTerm; text: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [shift, setShift] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const popId = useId();
  const refocusing = useRef(false);

  const close = () => {
    setOpen(false);
    setPinned(false);
  };

  // Outside click or tap closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Keep the popover inside the window, also at phone width.
  useLayoutEffect(() => {
    if (!open) {
      setShift(0);
      return;
    }
    const pop = popRef.current;
    if (!pop || typeof window === 'undefined') return;
    const rect = pop.getBoundingClientRect();
    const margin = 8;
    const left = rect.left - shift;
    const right = left + rect.width;
    let next = 0;
    if (right > window.innerWidth - margin) next = window.innerWidth - margin - right;
    if (left + next < margin) next = margin - left;
    if (next !== shift) setShift(next);
  }, [open]);

  const expansion = i18n.glossary(entry.id, 'expansion', entry.expansion);
  const definition = i18n.glossary(entry.id, 'definition', entry.definition);

  return (
    <span
      ref={wrapRef}
      className="gloss"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) close();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          close();
          refocusing.current = true;
          buttonRef.current?.focus();
          refocusing.current = false;
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="gloss-term"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        aria-describedby={open ? popId : undefined}
        onFocus={() => {
          if (!refocusing.current) setOpen(true);
        }}
        onClick={() => {
          if (pinned) close();
          else {
            setOpen(true);
            setPinned(true);
          }
        }}
      >
        {text}
      </button>
      {open && (
        <span
          ref={popRef}
          id={popId}
          className="gloss-pop"
          role="dialog"
          aria-label={t('glossary.dialog', { term: entry.term })}
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
        >
          <strong>{entry.term}</strong>
          {expansion && <span className="gloss-exp"> ({expansion})</span>}
          <span className="gloss-def">{definition}</span>
          <span className="gloss-src">
            {t('panel.sourceLabel')}{' '}
            <a href={entry.source.url} target="_blank" rel="noopener noreferrer">
              {entry.source.section}
            </a>
          </span>
        </span>
      )}
    </span>
  );
}

/** A block of panel text with the first occurrence of each glossary term made into a popover button. */
export function GlossaryText({ text }: { text: string | undefined }) {
  if (!text) return null;
  const list = entries();
  const pieces = splitGlossary(text, list);
  return (
    <>
      {pieces.map((p, i) => {
        const entry = p.id ? list.find((e) => e.id === p.id) : undefined;
        return entry ? <GlossaryTermButton key={i} entry={entry} text={p.text} /> : <span key={i}>{p.text}</span>;
      })}
    </>
  );
}

/** The whole glossary, for the Sources page. */
export function GlossaryList() {
  const i18n = useI18n();
  const { t } = i18n;
  const list = entries();
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="glossary-title">
      <h3 id="glossary-title">{t('glossary.heading', { count: list.length })}</h3>
      <p className="note">{t('glossary.intro')}</p>
      <dl className="glossary-list">
        {list.map((g) => {
          const expansion = i18n.glossary(g.id, 'expansion', g.expansion);
          return (
            <div key={g.id} id={`glossary-${g.id}`}>
              <dt>
                <strong>{g.term}</strong>
                {expansion && <span className="muted"> ({expansion})</span>}
              </dt>
              <dd>
                {i18n.glossary(g.id, 'definition', g.definition)}{' '}
                <span className="spec-source">
                  {t('panel.sourceLabel')}{' '}
                  <a href={g.source.url} target="_blank" rel="noopener noreferrer">
                    {g.source.section}
                  </a>
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
