import { renderTemplate } from '../utils';
import './PromptPreview.scss';

interface Props {
  template: string;
  fields: Record<string, string>;
}

export function PromptPreview({ template, fields }: Props) {
  const rendered = renderTemplate(template, fields);
  const parts = rendered.split(/({{[^}]+}})/g);

  return (
    <div className="prompt-preview">
      {parts.map((part, i) =>
        /^{{.+}}$/.test(part)
          ? <span key={i} className="prompt-preview__placeholder">{part}</span>
          : <span key={i}>{part}</span>
      )}
    </div>
  );
}
