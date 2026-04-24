export function extractPlaceholders(template: string): string[] {
  const keys: string[] = [], seen = new Set<string>();
  const re = /{{[#/]?([A-Z0-9_]+)}}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); keys.push(m[1]); }
  }
  return keys;
}

export function renderTemplate(template: string, fields: Record<string, string>): string {
  let out = template.replace(/{{#([A-Z0-9_]+)}}([\s\S]*?){{\/\1}}/g, (_, key, inner) =>
    fields[key]?.trim() ? inner : '');
  out = out.replace(/{{([A-Z0-9_]+)}}/g, (_, key) => fields[key]?.trim() || `{{${key}}}`);
  return out;
}
