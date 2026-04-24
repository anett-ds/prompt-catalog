import type { FieldDef } from '../supabase';
import './Field.scss';

interface Props {
  fieldDef: FieldDef;
  value: string;
  onChange: (v: string) => void;
}

export function Field({ fieldDef, value, onChange }: Props) {
  const { label, required, hint, type } = fieldDef;
  const isTextarea = type === 'textarea';
  const hasValue = (value || '').trim();

  return (
    <div className="field">
      <div className="field__header">
        <label className="field__label">
          {label}
          {required
            ? <span className="field__badge">REQUIRED</span>
            : <span className="field__optional">optional</span>}
        </label>
        {hint && (
          <button
            className={`field__hint-btn${hasValue ? ' field__hint-btn--clear' : ''}`}
            onClick={() => onChange(hasValue ? '' : hint)}
          >
            {hasValue ? 'Clear' : 'Use default'}
          </button>
        )}
      </div>
      {isTextarea
        ? <textarea
            className="input-base field__textarea"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={hint}
            rows={3}
          />
        : <input
            className="input-base field__input"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={hint}
          />}
    </div>
  );
}
