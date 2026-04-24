import { useState } from 'react';
import type { Prompt } from '../supabase';
import './ImportModal.scss';

interface Props {
  onClose: () => void;
  onImport: (imported: Prompt[]) => Promise<{ error?: string; success?: string }>;
}

export function ImportModal({ onClose, onImport }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleImport = async () => {
    setError('');
    setSuccess('');
    try {
      const imported = JSON.parse(text) as unknown;
      if (!Array.isArray(imported)) {
        setError('Invalid format — expected a JSON array.');
        return;
      }
      const result = await onImport(imported as Prompt[]);
      if (result.error) { setError(result.error); return; }
      setSuccess(result.success!);
      setTimeout(() => onClose(), 1500);
    } catch {
      setError('Failed to parse JSON. Please check the format.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog">
        <div className="modal-header">
          <h2 className="modal-title">Import Prompts</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="import-modal__description">
            Paste exported JSON below. Prompts already in the catalog (matched by ID) will be skipped.
          </p>
          <textarea
            className={`input-base import-modal__textarea${error ? ' import-modal__textarea--error' : ''}`}
            value={text}
            onChange={e => { setText(e.target.value); setError(''); setSuccess(''); }}
            rows={16}
            placeholder="Paste JSON here…"
          />
          {error && <p className="import-modal__error">{error}</p>}
          {success && <p className="import-modal__success">{success}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!text.trim()}
            onClick={handleImport}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
