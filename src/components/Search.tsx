import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { model } from '../data';
import { useExplorer } from '../state/store';
import { search } from './search';
import { useI18n } from '../i18n';

export function Search() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const select = useExplorer((s) => s.select);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const i18n = useI18n();
  const hits = useMemo(() => search(model, query, undefined, i18n), [query, i18n]);
  const showList = open && hits.length > 0;

  useEffect(() => {
    if (showList) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, showList, listId]);

  const choose = (path: string) => {
    select(path);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(hits.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      choose(hits[active].path);
    } else if (e.key === 'Escape') {
      // Close the results first; the global Escape (go up a level) must not fire.
      e.preventDefault();
      e.stopPropagation();
      if (showList) setOpen(false);
      else setQuery('');
    }
  };

  return (
    <div className="search">
      <input
        ref={inputRef}
        id="search-input"
        type="search"
        placeholder={i18n.t('search.placeholder')}
        aria-label={i18n.t('search.label')}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} role="listbox" className="search-results">
          {hits.map((h, i) => (
            <li
              key={h.path}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(h.path);
              }}
            >
              <span>{h.label}</span>
              <span className="muted">{h.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
