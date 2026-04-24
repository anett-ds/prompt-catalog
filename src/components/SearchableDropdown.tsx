import { useState, useEffect, useRef } from 'react';
import type { Prompt } from '../supabase';
import './SearchableDropdown.scss';

interface Props {
  options: Prompt[];
  value: string;
  onChange: (id: string) => void;
}

export function SearchableDropdown({ options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value);
  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="dropdown">
      <div
        className={`dropdown__trigger${open ? ' dropdown__trigger--open' : ''}`}
        onClick={() => { setOpen(o => !o); setQuery(''); }}
      >
        <span>{selected?.label ?? 'Select…'}</span>
        <span className="dropdown__arrow">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="dropdown__panel">
          <div className="dropdown__search">
            <input
              autoFocus
              className="input-base dropdown__search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search prompts…"
            />
          </div>
          <div className="dropdown__list">
            {filtered.length === 0
              ? <div className="dropdown__empty">No prompts found</div>
              : filtered.map(o => (
                <div
                  key={o.id}
                  className={`dropdown__item${o.id === value ? ' dropdown__item--selected' : ''}`}
                  onClick={() => { onChange(o.id); setOpen(false); setQuery(''); }}
                >
                  {o.label}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
