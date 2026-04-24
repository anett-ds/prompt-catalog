insert into prompts (label, description, prompt_template, fields, has_fields) values
(
  'Replace PrimeReact Imports',
  'Replace PrimeReact imports with wrapper components from shared-ui.',
  'I want to replace every PrimeReact {{PRIMEREACT_COMPONENT}} with our internal {{SHARED_UI_COMPONENT}} component.

## 1. Component Mapping

- Old: import { {{PRIMEREACT_COMPONENT}} } from ''{{PRIMEREACT_IMPORT_FROM}}''
- New: import { {{SHARED_UI_COMPONENT}} } from ''@ds-oc-fe/ui''

## 2. Scope

Targets:
{{TARGET_FOLDERS}}

Source (Reference only): shared-ui/ (Do NOT modify this folder).

## 3. Your Task (Planning Phase)

Please perform a deep analysis of the codebase and produce two things:

### A) Migration Plan (migration-plan-{{PRIMEREACT_COMPONENT}}.md)

Create this file in the root. It must include:
- A comparison of {{SHARED_UI_COMPONENT}} (in shared-ui) vs PrimeReact''s {{PRIMEREACT_COMPONENT}}.
- A definitive mapping of prop changes (e.g., disabled -> isDisabled, invalid -> hasError, etc.).
- A list of all files in the target folders that currently use the old component.
- Identification of any "risky" usages (e.g., complex event handlers or props that don''t exist in our internal version).

### B) Handover Prompt

Provide a final response in this chat containing a single, optimized prompt. This prompt will be used in a brand-new chat to execute the actual code changes. It should instruct the next Claude instance to read migration-plan-{{PRIMEREACT_COMPONENT}}.md and execute the refactor based on its findings.

## 4. Constraints

> IMPORTANT: Do NOT commit anything to Git. This will be done manually after the job is completed.

Please start by analyzing the component definitions and the target files.',
  '[
    {"key": "PRIMEREACT_COMPONENT", "label": "PrimeReact Component", "required": true, "hint": "InputTextarea", "type": "text"},
    {"key": "SHARED_UI_COMPONENT", "label": "Shared UI Component", "required": true, "hint": "TextArea", "type": "text"},
    {"key": "PRIMEREACT_IMPORT_FROM", "label": "PrimeReact Import From", "required": true, "hint": "primereact/inputtextarea", "type": "text"},
    {"key": "TARGET_FOLDERS", "label": "Target Folders", "required": true, "hint": "- apps/search-mfe/\n- apps/smartlit/\n- legacy/\n- shared-widgets/", "type": "textarea"}
  ]'::jsonb,
  true
),
(
  'Code Refactoring',
  'Generates a prompt for refactoring a legacy component using the refactor-feature skill. Fill in the fields below to customize the prompt for your target component.',
  'Using the refactor-feature skill, please refactor this legacy component.
Additional context:
   • Folder/Component: {{FOLDERS}}
   • Target: Align with patterns in {{TARGET}}{{#NOTES}}
   • Notes: {{NOTES}}{{/NOTES}}{{#OUTPUT}}
   • Output: The refactored component should be in {{OUTPUT}}{{/OUTPUT}}',
  '[
    {"key": "FOLDERS", "label": "Folders / Components", "required": true, "hint": "- legacy/alerts\n- shared-widgets/", "type": "textarea"},
    {"key": "TARGET", "label": "Align with Target", "required": true, "hint": "shared-widgets/backend-administration", "type": "text"},
    {"key": "NOTES", "label": "Notes", "required": false, "hint": "Part of the SmartLit refactor", "type": "text"},
    {"key": "OUTPUT", "label": "Output Folder", "required": false, "hint": "shared-widgets/alerts", "type": "text"}
  ]'::jsonb,
  true
);
