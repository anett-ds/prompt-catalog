import { useState } from 'react';
import './ExportModal.scss';

interface Props {
  json: string;
  onClose: () => void;
}

export function ExportModal({ json, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const doCopy = () => {
    const ta = document.getElementById('export-ta') as HTMLTextAreaElement;
    ta.focus();
    ta.select();
    document.execCommand('copy');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog">
        <div className="modal-header">
          <h2 className="modal-title">Export Prompts</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="export-modal__description">
            Copy this JSON to back up or share prompts with a teammate.
          </p>
          <textarea
            id="export-ta"
            className="input-base export-modal__textarea"
            readOnly
            value={json}
            rows={16}
            onFocus={e => e.target.select()}
          />
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button
            className={`export-modal__copy-btn${copied ? ' export-modal__copy-btn--copied' : ''}`}
            onClick={doCopy}
          >
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
