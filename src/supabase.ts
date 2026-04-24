import { createClient } from '@supabase/supabase-js';

export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  hint: string;
  type: 'text' | 'textarea';
}

export interface PromptRow {
  id: string;
  label: string;
  description: string;
  prompt_template: string;
  fields: FieldDef[];
  has_fields: boolean;
  created_at: string;
  updated_at: string;
}

export interface Prompt {
  id: string;
  label: string;
  description: string;
  promptTemplate: string;
  fields: FieldDef[];
  hasFields: boolean;
}

export function rowToPrompt(row: PromptRow): Prompt {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    promptTemplate: row.prompt_template,
    fields: row.fields,
    hasFields: row.has_fields,
  };
}

export function promptToRow(p: Omit<Prompt, 'id'>): Omit<PromptRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    label: p.label,
    description: p.description,
    prompt_template: p.promptTemplate,
    fields: p.fields,
    has_fields: p.hasFields,
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
