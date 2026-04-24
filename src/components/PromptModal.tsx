import { useState, useEffect } from 'react';
import type { Prompt, FieldDef } from '../supabase';
import { extractPlaceholders } from '../utils';
import { FieldRow } from './FieldRow';
import { PromptPreview } from './PromptPreview';
import './PromptModal.scss';

interface Props {
  editing: Prompt | null;
  onClose: () => void;
  onSave: (p: Omit<Prompt, 'id'>) => void;
}

export function PromptModal({ editing, onClose, onSave }: Props) {
  const [label, setLabel] = useState(editing?.label ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [template, setTemplate] = useState(editing?.promptTemplate ?? '');
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>(() =>
    (editing?.fields ?? []).map(f => ({ ...f }))
  );

  useEffect(() => {
    const keys = extractPlaceholders(template);
    setFieldDefs(prev => {
      const prevMap = Object.fromEntries(prev.map(f => [f.key, f]));
      return keys.map(k =>
        prevMap[k] ?? {
          key: k,
          label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          required: false,
          hint: '',
          type: 'text' as const,
        }
      );
    });
  }, [template]);

  const hasFields = fieldDefs.length > 0;
  const valid = label.trim() && template.trim();

  return (
    <div className="modal-overlay">
      <div className="modal-dialog">
        <div className="modal-header">
          <h2 className="modal-title">{editing ? 'Edit Prompt' : 'New Prompt'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="prompt-modal__name-row">
            {([
              ['Name', label, setLabel, 'e.g. PR Review Helper', true],
              ['Description', description, setDescription, 'What does this prompt do?', false],
            ] as const).map(([lbl, val, setter, ph, req]) => (
              <div key={lbl}>
                <label className="prompt-modal__field-label">
                  {lbl}
                  {req && <span className="prompt-modal__required-badge">REQUIRED</span>}
                </label>
                <input
                  className="input-base"
                  value={val}
                  onChange={e => setter(e.target.value)}
                  placeholder={ph}
                />
              </div>
            ))}
          </div>

          <div className="prompt-modal__template-section">
            <label className="prompt-modal__field-label">
              Prompt Template
              <span className="prompt-modal__required-badge">REQUIRED</span>
            </label>
            <textarea
              className="input-base prompt-modal__template-textarea"
              value={template}
              onChange={e => setTemplate(e.target.value)}
              rows={9}
              placeholder={'Write your prompt here.\n\nUse {{FIELD}} for dynamic fields.\nWrap optional sections with {{#FIELD}}...{{/FIELD}}.'}
            />
            <p className="prompt-modal__template-hint">
              <span className="prompt-modal__code">{'{{FIELD}}'}</span> for fields ·{' '}
              <span className="prompt-modal__code">{'{{#FIELD}}...{{/FIELD}}'}</span> for optional blocks
            </p>
          </div>

          {hasFields && (
            <div className="prompt-modal__fields-section">
              <div className="prompt-modal__section-header">
                <span className="section-label">Auto-detected Fields</span>
                <span className="prompt-modal__field-count">
                  {fieldDefs.length} placeholder{fieldDefs.length !== 1 ? 's' : ''} found
                </span>
              </div>
              {fieldDefs.map((f, i) => (
                <FieldRow
                  key={f.key}
                  fieldDef={f}
                  onChange={updated =>
                    setFieldDefs(prev => prev.map((x, j) => (j === i ? updated : x)))
                  }
                />
              ))}
            </div>
          )}

          {template.trim() && (
            <div>
              <div className="prompt-modal__section-header">
                <span className="section-label">Live Preview</span>
              </div>
              <PromptPreview template={template} fields={{}} />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!valid}
            onClick={() =>
              valid &&
              onSave({
                label: label.trim(),
                description: description.trim(),
                promptTemplate: template,
                fields: fieldDefs,
                hasFields,
              })
            }
          >
            {editing ? 'Save changes' : 'Add prompt'}
          </button>
        </div>
      </div>
    </div>
  );
}
