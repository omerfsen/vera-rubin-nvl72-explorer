import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { model } from '../data';
import { useExplorer } from '../state/store';
import { search } from './search';

export function Search() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const select = useExplorer((s) => s.select);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => search(model, query), [query]);

  const choose = (path: string) => {
    select(path);
    setQuery('');
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
      setQuery('');
    }
  };

  return (
    <div className="search">
      <input
        ref={inputRef}
        id="search-input"
        type="search"
        placeholder="Search parts, e.g. gpu, bluefield, tray 7"
        aria-label="Search parts"
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls={listId}
        aria-activedescendant={hits.length > 0 ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {hits.length > 0 && (
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
