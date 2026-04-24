import type { FieldDef } from '../supabase';
import './FieldRow.scss';

interface Props {
  fieldDef: FieldDef;
  onChange: (f: FieldDef) => void;
}

export function FieldRow({ fieldDef, onChange }: Props) {
  return (
    <div className="field-row">
      <div className="field-row__header">
        <span className="field-row__key-badge">{`{{${fieldDef.key}}}`}</span>
        <label className="field-row__checkbox-label">
          <input
            type="checkbox"
            checked={fieldDef.type === 'textarea'}
            onChange={e => onChange({ ...fieldDef, type: e.target.checked ? 'textarea' : 'text' })}
            className="field-row__checkbox"
          />
          Multi-line
        </label>
        <label className="field-row__checkbox-label">
          <input
            type="checkbox"
            checked={fieldDef.required}
            onChange={e => onChange({ ...fieldDef, required: e.target.checked })}
            className="field-row__checkbox"
          />
          Required
        </label>
      </div>

      <div className="field-row__grid">
        {(['label', 'hint'] as const).map((prop) => {
          const lbl = prop === 'label' ? 'Display Label' : 'Default / Placeholder';
          const ph = prop === 'label' ? fieldDef.key : 'e.g. legacy/alerts';
          const canMultiline = prop === 'hint';
          return (
            <div key={prop}>
              <label className="field-row__prop-label">{lbl}</label>
              {canMultiline && fieldDef.type === 'textarea'
                ? <textarea
                    className="input-base field-row__textarea"
                    value={fieldDef[prop]}
                    onChange={e => onChange({ ...fieldDef, [prop]: e.target.value })}
                    placeholder={ph}
                    rows={3}
                  />
                : <input
                    className="input-base"
                    value={fieldDef[prop]}
                    onChange={e => onChange({ ...fieldDef, [prop]: e.target.value })}
                    placeholder={ph}
                  />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
