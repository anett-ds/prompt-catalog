import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, rowToPrompt, promptToRow } from '../supabase';
import type { Prompt } from '../supabase';
import { renderTemplate } from '../utils';
import { Copycat } from '../components/Copycat';
import { MilestoneCelebration } from '../components/MilestoneCelebration';
import type { Milestone } from '../components/MilestoneCelebration';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { Field } from '../components/Field';
import { PromptPreview } from '../components/PromptPreview';
import { PromptModal } from '../components/PromptModal';
import { ExportModal } from '../components/ExportModal';
import { ImportModal } from '../components/ImportModal';
import './PromptCatalog.scss';

const VERSION = '2.0.1';

const MILESTONES: Milestone[] = [
  { count: 1, msg: "Welcome to the catalog! Your first prompt, copied with care. 🐾" },
  { count: 5, msg: "Five prompts down. The cat is impressed. 😼" },
  { count: 10, msg: "Ten copies! You're basically a prompt wizard now. 🧙‍♂️🐱" },
  { count: 25, msg: "25 prompts! The cat demands a treat. 🐟" },
  { count: 50, msg: "50 prompts copied. Legendary status unlocked. 🏆🐱" },
];

interface Props {
  session: Session;
  onLogout: () => void;
}

export default function PromptCatalog({ onLogout }: Props) {
  const [dark, setDark] = useState(true);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [promptTypeId, setPromptTypeId] = useState<string>('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copycatVisible, setCopycatVisible] = useState(false);
  const [copyCount, setCopyCount] = useState(0);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const promptType = prompts.find(p => p.id === promptTypeId) ?? prompts[0];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    setCopyCount(parseInt(localStorage.getItem('copy-count') ?? '0', 10));
    supabase.from('prompts').select('*').order('created_at').then(({ data }) => {
      if (data) {
        const loaded = data.map(rowToPrompt);
        setPrompts(loaded);
        if (loaded.length > 0) setPromptTypeId(loaded[0].id);
      }
      setLoading(false);
    });
  }, []);

  const handleAddOrEdit = async (p: Omit<Prompt, 'id'>) => {
    if (editing) {
      const { data } = await supabase.from('prompts').update(promptToRow(p)).eq('id', editing.id).select().single();
      if (data) {
        const updated = rowToPrompt(data);
        setPrompts(prev => prev.map(x => x.id === editing.id ? updated : x));
        setPromptTypeId(editing.id);
      }
    } else {
      const { data } = await supabase.from('prompts').insert(promptToRow(p)).select().single();
      if (data) {
        const added = rowToPrompt(data);
        setPrompts(prev => [...prev, added]);
        setPromptTypeId(added.id);
      }
    }
    setShowModal(false);
    setEditing(null);
    setFields({});
  };

  const handleDelete = async (id: string) => {
    await supabase.from('prompts').delete().eq('id', id);
    setPrompts(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (remaining.length > 0) setPromptTypeId(remaining[0].id);
      return remaining;
    });
    setConfirmDelete(null);
  };

  const handleExport = () => {
    if (prompts.length === 0) return;
    setExportJson(JSON.stringify(prompts, null, 2));
  };

  const handleImport = async (imported: Prompt[]): Promise<{ error?: string; success?: string }> => {
    const existingIds = new Set(prompts.map(p => p.id));
    const newOnes = imported.filter(p => p.id && p.label && p.promptTemplate && !existingIds.has(p.id));
    const dupes = imported.length - newOnes.length;
    if (newOnes.length === 0) {
      return { error: dupes > 0 ? 'All prompts already exist in the catalog.' : 'No valid prompts found.' };
    }
    const rows = newOnes.map(p => ({ id: p.id, ...promptToRow(p) }));
    const { data } = await supabase.from('prompts').insert(rows).select();
    if (!data) return { error: 'Import failed. Please try again.' };
    const added = data.map(rowToPrompt);
    setPrompts(prev => [...prev, ...added]);
    setPromptTypeId(added[added.length - 1].id);
    return {
      success: `Imported ${added.length} prompt${added.length !== 1 ? 's' : ''}${dupes > 0 ? ` (${dupes} duplicate${dupes !== 1 ? 's' : ''} skipped)` : ''}.`,
    };
  };

  const fallbackCopy = (text: string, onSuccess: () => void) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); onSuccess(); } catch { /* ignore */ }
    document.body.removeChild(ta);
  };

  const copy = async () => {
    const text = renderTemplate(promptType?.promptTemplate ?? '', fields);
    const succeed = () => {
      setCopied(true);
      setCopycatVisible(true);
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setCopycatVisible(false), 2200);
      const newCount = copyCount + 1;
      setCopyCount(newCount);
      localStorage.setItem('copy-count', String(newCount));
      const hit = MILESTONES.find(m => m.count === newCount);
      if (hit) setMilestone(hit);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(succeed).catch(() => fallbackCopy(text, succeed));
    } else {
      fallbackCopy(text, succeed);
    }
  };

  if (loading) {
    return (
      <div className="catalog-loading">
        <div className="catalog-loading__text">Loading the catalog…</div>
      </div>
    );
  }

  return (
    <div className="catalog">
      <div className="catalog__content">

        {/* Header */}
        <div className="catalog__header">
          <div className="catalog__brand">
            <div className="catalog__logo-icon">✨</div>
            <h1 className="catalog__title">FE Team Prompt Catalog</h1>
            <span className="catalog__version">v{VERSION}</span>
          </div>
          <div className="catalog__actions">
            <button
              className="catalog__btn catalog__btn--toggle"
              onClick={handleExport}
              disabled={prompts.length === 0}
            >
              ⬆ Export
            </button>
            <button
              className="catalog__btn catalog__btn--toggle"
              onClick={() => setShowImport(true)}
            >
              ⬇ Import
            </button>
            <button
              className="catalog__btn catalog__btn--toggle"
              onClick={onLogout}
            >
              🔓 Logout
            </button>
            <button
              className="catalog__btn catalog__btn--toggle"
              onClick={() => setDark(d => !d)}
            >
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Prompt selector card */}
        <div className="card">
          <label className="catalog__section-label">Prompt Type</label>
          {promptType && (
            <SearchableDropdown
              options={prompts}
              value={promptTypeId}
              onChange={id => { setPromptTypeId(id); setCopied(false); setFields({}); }}
            />
          )}
          <div className="catalog__selector-actions">
            <button
              className="catalog__btn catalog__btn--edit"
              onClick={() => { setEditing(promptType ?? null); setShowModal(true); }}
              disabled={!promptType}
            >
              Edit
            </button>
            <button
              className="catalog__btn catalog__btn--danger"
              onClick={() => promptType && setConfirmDelete(promptType.id)}
              disabled={!promptType}
            >
              Delete
            </button>
            <button
              className="catalog__btn catalog__btn--new"
              onClick={() => { setEditing(null); setShowModal(true); }}
            >
              + New
            </button>
          </div>
          <div className="catalog__description">
            <p className="catalog__description-text">{promptType?.description ?? 'No description.'}</p>
          </div>
          {confirmDelete === promptType?.id && (
            <div className="catalog__confirm-delete">
              <span className="catalog__confirm-delete-msg">Delete "{promptType.label}"?</span>
              <div className="catalog__confirm-delete-actions">
                <button
                  className="catalog__btn catalog__btn--ghost-sm"
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancel
                </button>
                <button
                  className="catalog__btn catalog__btn--danger-confirm"
                  onClick={() => handleDelete(promptType.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Fields card */}
        {promptType?.hasFields && (promptType.fields?.length ?? 0) > 0 && (
          <div className="card">
            <div className="catalog__card-header">
              <span className="catalog__section-label">Fields</span>
              <button className="catalog__btn catalog__btn--reset" onClick={() => setFields({})}>
                Reset
              </button>
            </div>
            {promptType.fields.map(f => (
              <Field
                key={f.key}
                fieldDef={f}
                value={fields[f.key] ?? ''}
                onChange={v => setFields(prev => ({ ...prev, [f.key]: v }))}
              />
            ))}
          </div>
        )}

        {/* Output card */}
        <div className="card catalog__output-card">
          <div className="catalog__card-header">
            <span className="catalog__section-label">Generated Prompt</span>
            <button
              className={`catalog__btn catalog__btn--copy${copied ? ' catalog__btn--copy-success' : ''}`}
              onClick={copy}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <PromptPreview template={promptType?.promptTemplate ?? ''} fields={fields} />
          {promptType?.hasFields && (
            <p className="catalog__placeholder-hint">
              Placeholders <span className="catalog__placeholder-example">{'{{like this}}'}</span> will be replaced as you fill in the fields above.
            </p>
          )}
        </div>
      </div>

      <Copycat visible={copycatVisible} />
      <MilestoneCelebration milestone={milestone} />
      {showModal && (
        <PromptModal
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleAddOrEdit}
        />
      )}
      {exportJson && <ExportModal json={exportJson} onClose={() => setExportJson(null)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />}
    </div>
  );
}
