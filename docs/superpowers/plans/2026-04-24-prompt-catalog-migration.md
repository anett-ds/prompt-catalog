# Prompt Catalog Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Artifact-only prompt catalog TSX into a Vite+React app backed by Supabase, with full-page login gate and GitHub Pages hosting.

**Architecture:** The existing `prompt-catalog.tsx` is adapted into `src/App.tsx` — all `window.storage` calls replaced with Supabase CRUD, `PasswordModal`/`isAdmin` removed in favour of a Supabase session gate rendered by `main.tsx`. `localStorage` is kept only for copy-count (personal counter).

**Tech Stack:** Vite 5, React 18, TypeScript, @supabase/supabase-js 2, GitHub Actions + GitHub Pages

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/main.tsx` | Create | Session gate — renders `<LoginPage>` or `<App>` |
| `src/supabase.ts` | Create | Supabase client singleton + DB row type |
| `src/LoginPage.tsx` | Create | Full-page email/password login form |
| `src/App.tsx` | Create (from TSX) | Main catalog, Supabase CRUD, no admin toggle |
| `src/App.css` | Delete generated | Not used — all styling is inline |
| `supabase/seed.sql` | Create | Two original built-in prompts as INSERT |
| `vite.config.ts` | Modify | Add `base` for GitHub Pages sub-path |
| `.env.local` | Create (manual) | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| `.github/workflows/deploy.yml` | Create | Build and push to `gh-pages` branch |

---

## Phase 1 — Local Development

---

### Task 1: Scaffold the Vite project

**Files:**
- Create: all scaffold files via CLI

- [ ] **Step 1: Scaffold**

```bash
cd /home/oclocal/Documents/apueschel/git/prompt-catalog
npm create vite@latest . -- --template react-ts
```

When prompted "Current directory is not empty. Remove existing files and continue?" — type `y`. The scaffold will overwrite generated files but will NOT delete `prompt-catalog.tsx` or `docs/`.

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install @supabase/supabase-js
```

- [ ] **Step 3: Verify the scaffold works**

```bash
npm run dev
```

Expected: terminal shows `Local: http://localhost:5173/`. Open that URL in a browser — you should see the default Vite+React page. Stop the server with `Ctrl+C`.

- [ ] **Step 4: Delete generated files we won't use**

```bash
rm src/App.css src/index.css public/vite.svg src/assets/react.svg
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite+React+TS project with supabase-js"
```

---

### Task 2: One-time Supabase setup (manual)

> **This is a manual task. Complete all steps before continuing to Task 3.**

**Prerequisites:** A browser, your Supabase account (or create a free one at supabase.com).

- [ ] **Step 1: Create a Supabase project**
  - Go to [supabase.com](https://supabase.com) → "New project"
  - Name: `prompt-catalog` (or anything)
  - Choose a region close to you
  - Set a strong database password (save it somewhere)
  - Wait ~2 minutes for provisioning

- [ ] **Step 2: Run the table + RLS SQL**

In the Supabase dashboard → **SQL Editor** → "New query", paste and run:

```sql
create table prompts (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  description text not null default '',
  prompt_template text not null,
  fields      jsonb not null default '[]',
  has_fields  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger prompts_updated_at
  before update on prompts
  for each row execute function set_updated_at();

alter table prompts enable row level security;

create policy "auth_full_access" on prompts
  for all to authenticated
  using (true)
  with check (true);
```

Expected: "Success. No rows returned."

- [ ] **Step 3: Disable email confirmations**
  - Dashboard → **Authentication** → **Settings** (left sidebar)
  - Under "Email Auth", toggle **"Enable email confirmations"** OFF
  - Click Save

- [ ] **Step 4: Create the shared user**
  - Dashboard → **Authentication** → **Users** → "Add user" → "Create new user"
  - Email: `fe_team@team.local` (or any valid email format you prefer)
  - Password: choose a strong password, share with team via Slack DM
  - Click "Create user"

- [ ] **Step 5: Note your credentials**
  - Dashboard → **Project Settings** → **API**
  - Copy **Project URL** (looks like `https://abcdefgh.supabase.co`)
  - Copy **anon / public** key (the long JWT string)
  - Keep these — you'll need them in Task 3 and for GitHub secrets later

---

### Task 3: Create `src/supabase.ts`

**Files:**
- Create: `src/supabase.ts`

- [ ] **Step 1: Create the Supabase client singleton**

Create `src/supabase.ts` with this content:

```typescript
import { createClient } from '@supabase/supabase-js';

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

export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  hint: string;
  type: 'text' | 'textarea';
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
```

- [ ] **Step 2: Create `.env.local`**

Create `.env.local` in the project root (replace with your actual values from Task 2 Step 5):

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 3: Verify `.gitignore` excludes it**

Open `.gitignore` (generated by Vite). Confirm `.env.local` is listed. If not, add it:

```
.env.local
```

- [ ] **Step 4: Commit (without .env.local)**

```bash
git add src/supabase.ts .gitignore
git commit -m "feat: add Supabase client singleton and Prompt types"
```

---

### Task 4: Create `supabase/seed.sql`

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Create the seed file**

```bash
mkdir -p supabase
```

Create `supabase/seed.sql`:

```sql
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
```

- [ ] **Step 2: Run seed in Supabase SQL Editor**

Go to Supabase dashboard → **SQL Editor** → "New query", paste the full contents of `supabase/seed.sql`, and run it.

Expected: "Success. 2 rows affected."

- [ ] **Step 3: Verify in Table Editor**

Dashboard → **Table Editor** → `prompts`. You should see 2 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: add seed SQL for two original built-in prompts"
```

---

### Task 5: Create `src/LoginPage.tsx`

**Files:**
- Create: `src/LoginPage.tsx`

- [ ] **Step 1: Create the login component**

Create `src/LoginPage.tsx`:

```typescript
import { useState } from 'react';
import { supabase } from './supabase';

const DARK = {
  page: '#06040f',
  card: '#110e1e',
  cardBorder: '#2e2a4a',
  heading: '#f0eeff',
  subtext: '#8a87b0',
  inputBg: '#13101f',
  inputBorder: '#2e2a4a',
  inputText: '#f0eeff',
  dangerText: '#f87171',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const th = DARK;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) setError('Invalid email or password.');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 8,
    border: `1.5px solid ${th.inputBorder}`,
    background: th.inputBg,
    padding: '10px 13px',
    fontSize: '0.9rem',
    outline: 'none',
    color: th.inputText,
    fontFamily: 'inherit',
    marginBottom: '1rem',
  };

  return (
    <div style={{ minHeight: '100vh', background: th.page, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: '1rem' }}>
      <div style={{ background: th.card, border: `1px solid ${th.cardBorder}`, borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', boxShadow: '0 0 16px rgba(139,92,246,0.4)' }}>✨</div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: th.heading, margin: 0 }}>FE Team Prompt Catalog</h1>
        </div>

        <form onSubmit={handleLogin}>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#b8b5e0', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="fe_team@team.local"
            required
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#7c3aed')}
            onBlur={e => (e.target.style.borderColor = th.inputBorder)}
          />

          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#b8b5e0', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ ...inputStyle, marginBottom: error ? '0.5rem' : '1.5rem' }}
            onFocus={e => (e.target.style.borderColor = '#7c3aed')}
            onBlur={e => (e.target.style.borderColor = th.inputBorder)}
          />

          {error && <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: th.dangerText }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', fontSize: '0.88rem', fontWeight: 700, padding: '10px 0', borderRadius: 8, border: 'none', background: loading ? '#4b4870' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 0 10px rgba(139,92,246,0.3)' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/LoginPage.tsx
git commit -m "feat: add LoginPage with Supabase email/password auth"
```

---

### Task 6: Create `src/App.tsx`

**Files:**
- Create: `src/App.tsx` (replacing scaffold's generated one)

- [ ] **Step 1: Replace `src/App.tsx` with the adapted catalog**

Create `src/App.tsx` with the full content below. Key changes from the original TSX:
- Removed `DEFAULT_PROMPTS`, `PasswordModal`, `isAdmin`, `showPasswordModal`, `ADMIN_PASSWORD`
- Replaced all `window.storage` calls with Supabase CRUD
- `copy-count` stays in `localStorage`
- Added `onLogout` prop
- All prompts are editable (no `builtin` guard on Edit/Delete buttons)
- `handleDelete` selects first remaining prompt after deletion

```typescript
import { useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, rowToPrompt, promptToRow, Prompt, FieldDef } from './supabase';

const VERSION = '2.0.0';

const MILESTONES = [
  { count: 1,  msg: "Welcome to the catalog! Your first prompt, copied with care. 🐾" },
  { count: 5,  msg: "Five prompts down. The cat is impressed. 😼" },
  { count: 10, msg: "Ten copies! You're basically a prompt wizard now. 🧙‍♂️🐱" },
  { count: 25, msg: "25 prompts! The cat demands a treat. 🐟" },
  { count: 50, msg: "50 prompts copied. Legendary status unlocked. 🏆🐱" },
];

function extractPlaceholders(template: string): string[] {
  const keys: string[] = [], seen = new Set<string>();
  const re = /{{[#/]?([A-Z0-9_]+)}}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); keys.push(m[1]); }
  }
  return keys;
}

function renderTemplate(template: string, fields: Record<string, string>): string {
  let out = template.replace(/{{#([A-Z0-9_]+)}}([\s\S]*?){{\/\1}}/g, (_, key, inner) =>
    fields[key]?.trim() ? inner : '');
  out = out.replace(/{{([A-Z0-9_]+)}}/g, (_, key) => fields[key]?.trim() || `{{${key}}}`);
  return out;
}

const DARK = {
  page: '#06040f', card: '#110e1e', cardBorder: '#2e2a4a', divider: '#1e1a30',
  heading: '#f0eeff', subtext: '#8a87b0', sectionLabel: '#7c3aed',
  labelColor: '#b8b5e0', optionalColor: '#6b6890', badgeBg: '#1e1a3a',
  inputBg: '#13101f', inputBorder: '#2e2a4a', inputText: '#f0eeff',
  previewBg: '#0f0d1a', previewBorder: '#2e2a4a', previewText: '#ddd9ff',
  placeholderText: '#a78bfa', placeholderBg: '#1e1a3a',
  resetBorder: '#2e2a4a', resetText: '#9d9abf', resetBg: 'transparent',
  hintText: '#4b4870', toggleBg: '#1e1a3a', toggleBorder: '#3d3a60', toggleText: '#9d9abf',
  dropdownBg: '#13101f', dropdownBorder: '#2e2a4a', dropdownText: '#f0eeff',
  descriptionBg: '#0f0d1a', descriptionBorder: '#2e2a4a', descriptionText: '#8a87b0',
  dangerText: '#f87171', dangerBorder: '#3b1f1f', dangerBg: 'transparent',
  modalOverlay: 'rgba(0,0,0,0.75)', modalBg: '#110e1e', modalBorder: '#2e2a4a',
  textareaBg: '#0f0d1a', fieldCardBg: '#0f0d1a', fieldCardBorder: '#2e2a4a',
  sectionDivider: '#1e1a30', successText: '#34d399',
};

const LIGHT = {
  page: '#f5f3ff', card: '#ffffff', cardBorder: '#ede9fe', divider: '#f3f4f6',
  heading: '#1e1b4b', subtext: '#6b7280', sectionLabel: '#6366f1',
  labelColor: '#4b5563', optionalColor: '#9ca3af', badgeBg: '#eef2ff',
  inputBg: '#ffffff', inputBorder: '#e5e7eb', inputText: '#111827',
  previewBg: '#faf5ff', previewBorder: '#ede9fe', previewText: '#1f2937',
  placeholderText: '#7c3aed', placeholderBg: '#ede9fe',
  resetBorder: '#e5e7eb', resetText: '#6b7280', resetBg: 'white',
  hintText: '#9ca3af', toggleBg: '#ede9fe', toggleBorder: '#ddd6fe', toggleText: '#6366f1',
  dropdownBg: '#ffffff', dropdownBorder: '#e5e7eb', dropdownText: '#111827',
  descriptionBg: '#faf5ff', descriptionBorder: '#ede9fe', descriptionText: '#6b7280',
  dangerText: '#dc2626', dangerBorder: '#fecaca', dangerBg: 'transparent',
  modalOverlay: 'rgba(0,0,0,0.35)', modalBg: '#ffffff', modalBorder: '#ede9fe',
  textareaBg: '#faf5ff', fieldCardBg: '#faf5ff', fieldCardBorder: '#ede9fe',
  sectionDivider: '#f3f4f6', successText: '#16a34a',
};

type Theme = typeof DARK;

function Copycat({ visible }: { visible: boolean }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.85)', transition: 'opacity 0.35s ease, transform 0.35s ease', pointerEvents: 'none' }}>
      <div style={{ fontSize: '2.4rem', lineHeight: 1, filter: 'drop-shadow(0 2px 8px rgba(139,92,246,0.4))' }}>🐱</div>
      <div style={{ fontSize: '0.6rem', textAlign: 'center', color: '#a78bfa', fontWeight: 700, letterSpacing: '0.05em', marginTop: 2 }}>copied!</div>
    </div>
  );
}

function MilestoneCelebration({ milestone }: { milestone: typeof MILESTONES[0] | null }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!milestone) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, [milestone]);
  if (!milestone) return null;
  return (
    <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: `translateX(-50%) translateY(${visible ? '0' : '16px'})`, zIndex: 200, pointerEvents: 'none', opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease, transform 0.4s ease' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e1a3a,#110e1e)', border: '1.5px solid #7c3aed', borderRadius: 14, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 30px rgba(139,92,246,0.4)', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: '1.6rem' }}>🐱</span>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f0eeff', marginBottom: 1 }}>{milestone.count} {milestone.count === 1 ? 'prompt' : 'prompts'} copied!</div>
          <div style={{ fontSize: '0.7rem', color: '#b8b5e0' }}>{milestone.msg}</div>
        </div>
      </div>
    </div>
  );
}

function SearchableDropdown({ options, value, onChange, th }: { options: Prompt[]; value: string; onChange: (id: string) => void; th: Theme }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value);
  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: '0.65rem' }}>
      <div onClick={() => { setOpen(o => !o); setQuery(''); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 9, border: `1.5px solid ${open ? '#7c3aed' : th.dropdownBorder}`, background: th.dropdownBg, color: th.dropdownText, padding: '10px 13px', fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none', transition: 'border-color 0.15s' }}>
        <span>{selected?.label || 'Select…'}</span>
        <span style={{ fontSize: '0.6rem', color: th.optionalColor, marginLeft: 8 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: th.dropdownBg, border: `1.5px solid #7c3aed`, borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${th.divider}` }}>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search prompts…"
              style={{ width: '100%', boxSizing: 'border-box', borderRadius: 7, border: `1.5px solid ${th.inputBorder}`, background: th.inputBg, padding: '7px 10px', fontSize: '0.82rem', outline: 'none', color: th.inputText, fontFamily: 'inherit' }}
              onFocus={e => (e.target.style.borderColor = '#7c3aed')} onBlur={e => (e.target.style.borderColor = th.inputBorder)} />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0
              ? <div style={{ padding: '10px 13px', fontSize: '0.82rem', color: th.optionalColor }}>No prompts found</div>
              : filtered.map(o => (
                <div key={o.id} onClick={() => { onChange(o.id); setOpen(false); setQuery(''); }}
                  style={{ padding: '9px 13px', fontSize: '0.88rem', cursor: 'pointer', color: o.id === value ? th.placeholderText : th.dropdownText, background: o.id === value ? th.placeholderBg : 'transparent', fontWeight: o.id === value ? 600 : 400, transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = th.badgeBg)}
                  onMouseLeave={e => (e.currentTarget.style.background = o.id === value ? th.placeholderBg : 'transparent')}>
                  {o.label}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function inputBase(th: Theme): React.CSSProperties {
  return { width: '100%', boxSizing: 'border-box', borderRadius: 8, border: `1.5px solid ${th.inputBorder}`, background: th.inputBg, padding: '8px 11px', fontSize: '0.82rem', outline: 'none', color: th.inputText, fontFamily: 'inherit', transition: 'border-color 0.15s' };
}

function PromptPreview({ template, fields, th }: { template: string; fields: Record<string, string>; th: Theme }) {
  const rendered = renderTemplate(template, fields);
  const parts = rendered.split(/({{[^}]+}})/g);
  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${th.previewBorder}`, background: th.previewBg, padding: '12px 14px', fontSize: '0.78rem', fontFamily: "'Fira Mono','Courier New',monospace", lineHeight: 1.8, color: th.previewText, whiteSpace: 'pre-wrap', minHeight: 80, overflow: 'auto' }}>
      {parts.map((part, i) =>
        /^{{.+}}$/.test(part)
          ? <span key={i} style={{ color: th.placeholderText, background: th.placeholderBg, borderRadius: 4, padding: '1px 4px', fontWeight: 700 }}>{part}</span>
          : <span key={i}>{part}</span>
      )}
    </div>
  );
}

function Field({ fieldDef, value, onChange, th }: { fieldDef: FieldDef; value: string; onChange: (v: string) => void; th: Theme }) {
  const { label, required, hint, type } = fieldDef;
  const isTextarea = type === 'textarea';
  const hasValue = (value || '').trim();
  const focus = (e: React.FocusEvent<HTMLElement>) => ((e.target as HTMLElement).style.borderColor = '#7c3aed');
  const blur = (e: React.FocusEvent<HTMLElement>) => ((e.target as HTMLElement).style.borderColor = th.inputBorder);
  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, color: th.labelColor, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
          {required
            ? <span style={{ color: '#818cf8', background: th.badgeBg, borderRadius: 4, padding: '1px 6px', fontSize: '0.62rem' }}>REQUIRED</span>
            : <span style={{ color: th.optionalColor, fontWeight: 400, textTransform: 'none', fontSize: '0.72rem', letterSpacing: 0 }}>optional</span>}
        </label>
        {hint && (
          <button onClick={() => onChange(hasValue ? '' : hint)}
            style={{ fontSize: '0.68rem', fontWeight: 600, color: hasValue ? th.dangerText : th.placeholderText, background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.7 }}>
            {hasValue ? 'Clear' : 'Use default'}
          </button>
        )}
      </div>
      {isTextarea
        ? <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={hint} rows={3}
            style={{ ...inputBase(th), fontFamily: "'Fira Mono','Courier New',monospace", fontSize: '0.8rem', lineHeight: 1.7, resize: 'vertical', background: th.textareaBg } as React.CSSProperties}
            onFocus={focus} onBlur={blur} />
        : <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={hint}
            style={{ ...inputBase(th), padding: '9px 13px', fontSize: '0.875rem' }}
            onFocus={focus} onBlur={blur} />}
    </div>
  );
}

function FieldRow({ th, fieldDef, onChange }: { th: Theme; fieldDef: FieldDef; onChange: (f: FieldDef) => void }) {
  return (
    <div style={{ background: th.fieldCardBg, border: `1px solid ${th.fieldCardBorder}`, borderRadius: 10, padding: '0.9rem', marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
        <span style={{ fontFamily: "'Fira Mono',monospace", fontSize: '0.72rem', color: th.placeholderText, background: th.placeholderBg, borderRadius: 4, padding: '2px 7px', fontWeight: 700 }}>{`{{${fieldDef.key}}}`}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: th.subtext, cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={fieldDef.type === 'textarea'} onChange={e => onChange({ ...fieldDef, type: e.target.checked ? 'textarea' : 'text' })} style={{ accentColor: '#7c3aed', width: 13, height: 13 }} />
          Multi-line
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: th.subtext, cursor: 'pointer', marginLeft: 4, userSelect: 'none' }}>
          <input type="checkbox" checked={fieldDef.required} onChange={e => onChange({ ...fieldDef, required: e.target.checked })} style={{ accentColor: '#7c3aed', width: 13, height: 13 }} />
          Required
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {([['Display Label', 'label', fieldDef.key, false], ['Default / Placeholder', 'hint', 'e.g. legacy/alerts', true]] as const).map(([lbl, prop, ph, canMultiline]) => (
          <div key={prop}>
            <label style={{ display: 'block', fontSize: '0.67rem', fontWeight: 700, color: th.labelColor, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>{lbl}</label>
            {canMultiline && fieldDef.type === 'textarea'
              ? <textarea value={fieldDef[prop]} onChange={e => onChange({ ...fieldDef, [prop]: e.target.value })} placeholder={ph} rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: `1.5px solid ${th.inputBorder}`, background: th.textareaBg, padding: '8px 11px', fontSize: '0.82rem', outline: 'none', color: th.inputText, fontFamily: "'Fira Mono','Courier New',monospace", lineHeight: 1.6, resize: 'vertical' } as React.CSSProperties}
                  onFocus={e => (e.target.style.borderColor = '#7c3aed')} onBlur={e => (e.target.style.borderColor = th.inputBorder)} />
              : <input value={fieldDef[prop]} onChange={e => onChange({ ...fieldDef, [prop]: e.target.value })} placeholder={ph}
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: `1.5px solid ${th.inputBorder}`, background: th.inputBg, padding: '8px 11px', fontSize: '0.82rem', outline: 'none', color: th.inputText, fontFamily: 'inherit' }}
                  onFocus={e => (e.target.style.borderColor = '#7c3aed')} onBlur={e => (e.target.style.borderColor = th.inputBorder)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PromptModal({ th, onClose, onSave, editing }: { th: Theme; onClose: () => void; onSave: (p: Omit<Prompt, 'id'>) => void; editing: Prompt | null }) {
  const [label, setLabel] = useState(editing?.label || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [template, setTemplate] = useState(editing?.promptTemplate || '');
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>(() => (editing?.fields || []).map(f => ({ ...f })));

  useEffect(() => {
    const keys = extractPlaceholders(template);
    setFieldDefs(prev => {
      const prevMap = Object.fromEntries(prev.map(f => [f.key, f]));
      return keys.map(k => prevMap[k] || { key: k, label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), required: false, hint: '', type: 'text' as const });
    });
  }, [template]);

  const hasFields = fieldDefs.length > 0;
  const valid = label.trim() && template.trim();

  return (
    <div style={{ position: 'fixed', inset: 0, background: th.modalOverlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: th.modalBg, border: `1px solid ${th.modalBorder}`, borderRadius: 16, width: '100%', maxWidth: 680, boxShadow: '0 8px 40px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 1.5rem', borderBottom: `1px solid ${th.sectionDivider}`, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: th.heading }}>{editing ? 'Edit Prompt' : 'New Prompt'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: th.subtext, fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem', marginBottom: '1.1rem' }}>
            {([['Name', label, setLabel, 'e.g. PR Review Helper', true], ['Description', description, setDescription, 'What does this prompt do?', false]] as const).map(([lbl, val, setter, ph, req]) => (
              <div key={lbl}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', fontWeight: 700, color: th.labelColor, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 5 }}>
                  {lbl} {req && <span style={{ color: '#818cf8', background: th.badgeBg, borderRadius: 4, padding: '1px 5px', fontSize: '0.6rem' }}>REQUIRED</span>}
                </label>
                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph}
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: `1.5px solid ${th.inputBorder}`, background: th.inputBg, padding: '8px 11px', fontSize: '0.82rem', outline: 'none', color: th.inputText, fontFamily: 'inherit' }}
                  onFocus={e => (e.target.style.borderColor = '#7c3aed')} onBlur={e => (e.target.style.borderColor = th.inputBorder)} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: '1.1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', fontWeight: 700, color: th.labelColor, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 5 }}>
              Prompt Template <span style={{ color: '#818cf8', background: th.badgeBg, borderRadius: 4, padding: '1px 5px', fontSize: '0.6rem' }}>REQUIRED</span>
            </label>
            <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={9}
              placeholder={'Write your prompt here.\n\nUse {{FIELD}} for dynamic fields.\nWrap optional sections with {{#FIELD}}...{{/FIELD}}.'}
              style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: `1.5px solid ${th.inputBorder}`, background: th.textareaBg, padding: '9px 13px', fontSize: '0.78rem', fontFamily: "'Fira Mono','Courier New',monospace", outline: 'none', color: th.inputText, lineHeight: 1.7, resize: 'vertical' } as React.CSSProperties}
              onFocus={e => (e.target.style.borderColor = '#7c3aed')} onBlur={e => (e.target.style.borderColor = th.inputBorder)} />
            <p style={{ margin: '5px 0 0', fontSize: '0.7rem', color: th.hintText }}>
              <span style={{ color: th.placeholderText, fontFamily: 'monospace' }}>{'{{FIELD}}'}</span> for fields · <span style={{ color: th.placeholderText, fontFamily: 'monospace' }}>{'{{#FIELD}}...{{/FIELD}}'}</span> for optional blocks
            </p>
          </div>
          {hasFields && (
            <div style={{ marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem', paddingBottom: '0.6rem', borderBottom: `1px solid ${th.sectionDivider}` }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: th.sectionLabel, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Auto-detected Fields</span>
                <span style={{ fontSize: '0.68rem', color: th.subtext }}>{fieldDefs.length} placeholder{fieldDefs.length !== 1 ? 's' : ''} found</span>
              </div>
              {fieldDefs.map((f, i) => (
                <FieldRow key={f.key} th={th} fieldDef={f} onChange={updated => setFieldDefs(prev => prev.map((x, j) => j === i ? updated : x))} />
              ))}
            </div>
          )}
          {template.trim() && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem', paddingBottom: '0.6rem', borderBottom: `1px solid ${th.sectionDivider}` }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: th.sectionLabel, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Live Preview</span>
              </div>
              <PromptPreview template={template} fields={{}} th={th} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '1rem 1.5rem', borderTop: `1px solid ${th.sectionDivider}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ fontSize: '0.8rem', fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${th.resetBorder}`, background: th.resetBg, color: th.resetText, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => valid && onSave({ label: label.trim(), description: description.trim(), promptTemplate: template, fields: fieldDefs, hasFields })} disabled={!valid}
            style={{ fontSize: '0.8rem', fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: valid ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#4b4870', color: 'white', cursor: valid ? 'pointer' : 'not-allowed', boxShadow: valid ? '0 0 10px rgba(139,92,246,0.3)' : 'none' }}>
            {editing ? 'Save changes' : 'Add prompt'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportModal({ th, json, onClose }: { th: Theme; json: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    const ta = document.getElementById('export-ta') as HTMLTextAreaElement;
    ta.focus(); ta.select();
    document.execCommand('copy');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: th.modalOverlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: th.modalBg, border: `1px solid ${th.modalBorder}`, borderRadius: 16, width: '100%', maxWidth: 680, boxShadow: '0 8px 40px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 1.5rem', borderBottom: `1px solid ${th.sectionDivider}`, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: th.heading }}>Export Prompts</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: th.subtext, fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem', flex: 1, overflowY: 'auto' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: th.descriptionText }}>Copy this JSON to back up or share prompts with a teammate.</p>
          <textarea id="export-ta" readOnly value={json} rows={16} onFocus={e => e.target.select()}
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: `1.5px solid ${th.inputBorder}`, background: th.textareaBg, padding: '10px 13px', fontSize: '0.75rem', fontFamily: "'Fira Mono','Courier New',monospace", color: th.previewText, lineHeight: 1.6, resize: 'vertical', outline: 'none' } as React.CSSProperties} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '1rem 1.5rem', borderTop: `1px solid ${th.sectionDivider}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ fontSize: '0.8rem', fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${th.resetBorder}`, background: th.resetBg, color: th.resetText, cursor: 'pointer' }}>Close</button>
          <button onClick={doCopy}
            style={{ fontSize: '0.8rem', fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: copied ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', cursor: 'pointer', boxShadow: copied ? '0 0 10px rgba(16,185,129,0.35)' : '0 0 10px rgba(139,92,246,0.3)', transition: 'all 0.2s' }}>
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ th, onClose, onImport }: { th: Theme; onClose: () => void; onImport: (imported: Prompt[]) => Promise<{ error?: string; success?: string }> }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleImport = async () => {
    setError(''); setSuccess('');
    try {
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) { setError('Invalid format — expected a JSON array.'); return; }
      const result = await onImport(imported);
      if (result.error) { setError(result.error); return; }
      setSuccess(result.success!);
      setTimeout(() => onClose(), 1500);
    } catch (_) {
      setError('Failed to parse JSON. Please check the format.');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: th.modalOverlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: th.modalBg, border: `1px solid ${th.modalBorder}`, borderRadius: 16, width: '100%', maxWidth: 680, boxShadow: '0 8px 40px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 1.5rem', borderBottom: `1px solid ${th.sectionDivider}`, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: th.heading }}>Import Prompts</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: th.subtext, fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem', flex: 1, overflowY: 'auto' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: th.descriptionText }}>Paste exported JSON below. Prompts already in the catalog (matched by ID) will be skipped.</p>
          <textarea value={text} onChange={e => { setText(e.target.value); setError(''); setSuccess(''); }} rows={16}
            placeholder="Paste JSON here…"
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: `1.5px solid ${error ? th.dangerText : th.inputBorder}`, background: th.textareaBg, padding: '10px 13px', fontSize: '0.75rem', fontFamily: "'Fira Mono','Courier New',monospace", color: th.previewText, lineHeight: 1.6, resize: 'vertical', outline: 'none' } as React.CSSProperties}
            onFocus={e => (e.target.style.borderColor = error ? th.dangerText : '#7c3aed')} onBlur={e => (e.target.style.borderColor = error ? th.dangerText : th.inputBorder)} />
          {error && <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: th.dangerText }}>{error}</p>}
          {success && <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: th.successText }}>{success}</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '1rem 1.5rem', borderTop: `1px solid ${th.sectionDivider}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ fontSize: '0.8rem', fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${th.resetBorder}`, background: th.resetBg, color: th.resetText, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleImport} disabled={!text.trim()}
            style={{ fontSize: '0.8rem', fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: text.trim() ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#4b4870', color: 'white', cursor: text.trim() ? 'pointer' : 'not-allowed', boxShadow: text.trim() ? '0 0 10px rgba(139,92,246,0.3)' : 'none' }}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App({ session, onLogout }: { session: Session; onLogout: () => void }) {
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
  const [milestone, setMilestone] = useState<typeof MILESTONES[0] | null>(null);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const th = dark ? DARK : LIGHT;
  const promptType = prompts.find(p => p.id === promptTypeId) || prompts[0];

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = 'input::placeholder, textarea::placeholder { opacity: 0.35 !important; }';
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const count = parseInt(localStorage.getItem('copy-count') || '0', 10);
    setCopyCount(count);

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
      const { data } = await supabase
        .from('prompts')
        .update(promptToRow(p))
        .eq('id', editing.id)
        .select()
        .single();
      if (data) {
        const updated = rowToPrompt(data);
        setPrompts(prev => prev.map(x => x.id === editing.id ? updated : x));
        setPromptTypeId(editing.id);
      }
    } else {
      const { data } = await supabase
        .from('prompts')
        .insert(promptToRow(p))
        .select()
        .single();
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
    if (newOnes.length === 0) return { error: dupes > 0 ? 'All prompts already exist in the catalog.' : 'No valid prompts found.' };
    const rows = newOnes.map(p => ({ id: p.id, ...promptToRow(p) }));
    const { data } = await supabase.from('prompts').insert(rows).select();
    if (!data) return { error: 'Import failed. Please try again.' };
    const added = data.map(rowToPrompt);
    setPrompts(prev => [...prev, ...added]);
    setPromptTypeId(added[added.length - 1].id);
    return { success: `Imported ${added.length} prompt${added.length !== 1 ? 's' : ''}${dupes > 0 ? ` (${dupes} duplicate${dupes !== 1 ? 's' : ''} skipped)` : ''}.` };
  };

  const copy = async () => {
    const text = renderTemplate(promptType?.promptTemplate || '', fields);
    const succeed = () => {
      setCopied(true); setCopycatVisible(true);
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
    } else { fallbackCopy(text, succeed); }
  };

  const fallbackCopy = (text: string, onSuccess: () => void) => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); onSuccess(); } catch (_) {}
    document.body.removeChild(ta);
  };

  const cardStyle: React.CSSProperties = {
    background: th.card, borderRadius: 16, padding: '1.5rem',
    boxShadow: dark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 2px 12px rgba(99,102,241,0.08)',
    marginBottom: '1.25rem', border: `1px solid ${th.cardBorder}`, transition: 'background 0.2s',
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: DARK.page, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: '0.8rem', color: '#8a87b0' }}>Loading the catalog…</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", minHeight: '100vh', background: th.page, display: 'flex', justifyContent: 'center', padding: '2.5rem 1rem', transition: 'background 0.2s' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', boxShadow: dark ? '0 0 16px rgba(139,92,246,0.4)' : '0 2px 8px rgba(99,102,241,0.25)' }}>✨</div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: th.heading, margin: 0 }}>FE Team Prompt Catalog</h1>
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: th.optionalColor, alignSelf: 'flex-end', marginBottom: 2 }}>v{VERSION}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handleExport} disabled={prompts.length === 0}
              style={{ fontSize: '0.75rem', fontWeight: 600, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${th.toggleBorder}`, background: th.toggleBg, color: prompts.length === 0 ? th.optionalColor : th.toggleText, cursor: prompts.length === 0 ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: prompts.length === 0 ? 0.5 : 1 }}>
              ⬆ Export
            </button>
            <button onClick={() => setShowImport(true)}
              style={{ fontSize: '0.75rem', fontWeight: 600, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${th.toggleBorder}`, background: th.toggleBg, color: th.toggleText, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ⬇ Import
            </button>
            <button onClick={onLogout}
              style={{ fontSize: '0.75rem', fontWeight: 600, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${th.toggleBorder}`, background: th.toggleBg, color: th.toggleText, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🔓 Logout
            </button>
            <button onClick={() => setDark(d => !d)}
              style={{ fontSize: '0.75rem', fontWeight: 600, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${th.toggleBorder}`, background: th.toggleBg, color: th.toggleText, cursor: 'pointer' }}>
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Prompt selector */}
        <div style={cardStyle}>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: th.sectionLabel, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Prompt Type</label>
          {promptType && <SearchableDropdown options={prompts} value={promptTypeId} onChange={id => { setPromptTypeId(id); setCopied(false); setFields({}); }} th={th} />}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
            <button onClick={() => { setEditing(promptType); setShowModal(true); }} disabled={!promptType}
              style={{ fontSize: '0.78rem', fontWeight: 600, padding: '6px 13px', borderRadius: 8, border: `1.5px solid ${th.resetBorder}`, background: th.resetBg, color: !promptType ? th.optionalColor : th.resetText, cursor: !promptType ? 'not-allowed' : 'pointer', opacity: !promptType ? 0.5 : 1 }}>✏️ Edit</button>
            <button onClick={() => promptType && setConfirmDelete(promptType.id)} disabled={!promptType}
              style={{ fontSize: '0.78rem', fontWeight: 600, padding: '6px 13px', borderRadius: 8, border: `1.5px solid ${th.dangerBorder}`, background: th.dangerBg, color: !promptType ? th.optionalColor : th.dangerText, cursor: !promptType ? 'not-allowed' : 'pointer', opacity: !promptType ? 0.5 : 1 }}>🗑️ Delete</button>
            <button onClick={() => { setEditing(null); setShowModal(true); }}
              style={{ fontSize: '0.8rem', fontWeight: 700, padding: '7px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 0 10px rgba(139,92,246,0.3)', marginLeft: 'auto' }}>
              + New
            </button>
          </div>
          <div style={{ borderRadius: 9, border: `1px solid ${th.descriptionBorder}`, background: th.descriptionBg, padding: '10px 13px' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: th.descriptionText, lineHeight: 1.6 }}>{promptType?.description || 'No description.'}</p>
          </div>
          {confirmDelete === promptType?.id && (
            <div style={{ marginTop: '0.75rem', borderRadius: 9, border: `1px solid ${th.dangerBorder}`, padding: '10px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: '0.8rem', color: th.dangerText }}>Delete "{promptType.label}"?</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setConfirmDelete(null)} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: `1px solid ${th.resetBorder}`, background: th.resetBg, color: th.resetText, cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => handleDelete(promptType.id)} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          )}
        </div>

        {/* Fields */}
        {promptType?.hasFields && promptType.fields?.length > 0 && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: `1px solid ${th.divider}` }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: th.sectionLabel, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Fields</span>
              <button onClick={() => setFields({})} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '5px 13px', borderRadius: 7, border: `1.5px solid ${th.resetBorder}`, background: th.resetBg, color: th.resetText, cursor: 'pointer' }}>Reset</button>
            </div>
            {promptType.fields.map(f => (
              <Field key={f.key} fieldDef={f} value={fields[f.key] || ''} onChange={v => setFields(prev => ({ ...prev, [f.key]: v }))} th={th} />
            ))}
          </div>
        )}

        {/* Output */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: `1px solid ${th.divider}` }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: th.sectionLabel, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Generated Prompt</span>
            <button onClick={copy} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '5px 13px', borderRadius: 7, border: 'none', cursor: 'pointer', background: copied ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', boxShadow: copied ? '0 0 12px rgba(16,185,129,0.35)' : '0 0 12px rgba(139,92,246,0.35)', transition: 'all 0.2s' }}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <PromptPreview template={promptType?.promptTemplate || ''} fields={fields} th={th} />
          {promptType?.hasFields && (
            <p style={{ fontSize: '0.72rem', color: th.hintText, marginTop: 8, marginBottom: 0 }}>
              Placeholders <span style={{ color: th.placeholderText }}>{'{{like this}}'}</span> will be replaced as you fill in the fields above.
            </p>
          )}
        </div>
      </div>

      <Copycat visible={copycatVisible} />
      <MilestoneCelebration milestone={milestone} />
      {showModal && <PromptModal th={th} editing={editing} onClose={() => { setShowModal(false); setEditing(null); }} onSave={handleAddOrEdit} />}
      {exportJson && <ExportModal th={th} json={exportJson} onClose={() => setExportJson(null)} />}
      {showImport && <ImportModal th={th} onClose={() => setShowImport(false)} onImport={handleImport} />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: adapt App.tsx for Supabase CRUD, remove window.storage and admin toggle"
```

---

### Task 7: Create `src/main.tsx` with session gate

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Replace `src/main.tsx`**

```typescript
import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import App from './App';
import LoginPage from './LoginPage';

function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: '#06040f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: '0.8rem', color: '#8a87b0' }}>Loading…</div>
      </div>
    );
  }

  if (session === null) return <LoginPage />;

  return <App session={session} onLogout={() => supabase.auth.signOut()} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
```

- [ ] **Step 2: Commit**

```bash
git add src/main.tsx
git commit -m "feat: add session gate in main.tsx, route to LoginPage or App"
```

---

### Task 8: Verify local development

> **This step verifies Phase 1 is complete. All steps must pass before moving to Phase 2.**

- [ ] **Step 1: Confirm `.env.local` has real credentials**

```bash
grep VITE_SUPABASE_URL .env.local
```

Expected: prints your actual Supabase URL (not a placeholder). If it still shows placeholder values, update them now from Task 2 Step 5.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

Expected: `Local: http://localhost:5173/`

- [ ] **Step 3: Verify login gate**

Open `http://localhost:5173/` in a browser. You should see the login page (purple gradient, "FE Team Prompt Catalog" heading). The catalog itself is NOT visible.

- [ ] **Step 4: Verify login works**

Enter the shared email and password from Task 2 Step 4. Click "Sign in". Expected: catalog loads showing the 2 seeded prompts.

- [ ] **Step 5: Verify CRUD**
  - **Create**: Click "+ New", fill in a name and template, click "Add prompt". Confirm it appears in the dropdown.
  - **Read**: Reload the page (Ctrl+R). Confirm the new prompt is still there (it came from Supabase, not local state).
  - **Edit**: Select the new prompt, click "✏️ Edit", change the name, click "Save changes". Confirm the updated name shows.
  - **Delete**: With the edited prompt selected, click "🗑️ Delete", then "Delete" in the confirmation. Confirm it's gone.

- [ ] **Step 6: Verify logout**

Click "🔓 Logout". Confirm the login page appears and the catalog is not accessible.

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors, `dist/` directory created.

---

### Task 9: Configure Vite for GitHub Pages

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Set the `base` path**

GitHub Pages serves your app at `https://<username>.github.io/<repo-name>/`. Vite needs to know the sub-path so asset URLs are correct.

Open `vite.config.ts` (generated by scaffold). Replace its content:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/prompt-catalog/',
});
```

> **Note:** If your GitHub repo name is NOT `prompt-catalog`, change the `base` value to match `/<your-repo-name>/`.

- [ ] **Step 2: Verify build still works**

```bash
npm run build
```

Expected: still succeeds, `dist/` created.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: set vite base path for GitHub Pages deployment"
```

---

### Task 10: Create GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow**

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions workflow to deploy to gh-pages"
```

---

## Phase 2 — GitHub Pages Deployment

---

### Task 11: Create GitHub repo and push (manual + commands)

- [ ] **Step 1: Create a GitHub repo**
  - Go to github.com → "New repository"
  - Name: `prompt-catalog` (must match the `base` in `vite.config.ts`)
  - Visibility: **Private** (recommended — login still protects the app, but source code and prompt data in seed.sql are visible)
  - Do NOT initialize with README

- [ ] **Step 2: Add remote and push**

```bash
git remote add origin https://github.com/<your-username>/prompt-catalog.git
git branch -M main
git push -u origin main
```

Expected: push succeeds, GitHub Actions run appears at `https://github.com/<your-username>/prompt-catalog/actions` within ~30 seconds.

---

### Task 12: Add GitHub Actions secrets (manual)

- [ ] **Step 1: Add the secrets**
  - Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**
  - Click "New repository secret"
  - Add `VITE_SUPABASE_URL` — value: your Project URL from Task 2 Step 5
  - Add `VITE_SUPABASE_ANON_KEY` — value: your anon key from Task 2 Step 5

- [ ] **Step 2: Re-trigger the workflow**

The first push happened before the secrets were set, so the build likely failed (missing env vars). Trigger a new run:

```bash
git commit --allow-empty -m "ci: trigger deploy after adding secrets"
git push
```

Wait ~2 minutes. Check `https://github.com/<your-username>/prompt-catalog/actions` — the latest run should show green ✓.

---

### Task 13: Enable GitHub Pages (manual)

- [ ] **Step 1: Enable Pages from `gh-pages` branch**
  - Repo → **Settings** → **Pages** (left sidebar)
  - Under "Build and deployment" → "Source": select **Deploy from a branch**
  - Branch: `gh-pages` / `/ (root)` → click **Save**

- [ ] **Step 2: Wait for deployment**

Wait ~1 minute. GitHub will show the URL at the top of the Pages settings page: `https://<your-username>.github.io/prompt-catalog/`

---

### Task 14: Final verification (manual)

- [ ] Open `https://<your-username>.github.io/prompt-catalog/` in a browser
- [ ] Confirm login page loads
- [ ] Sign in with the shared credentials
- [ ] Confirm catalog loads with the 2 seeded prompts
- [ ] Add a prompt and confirm it appears
- [ ] Reload — confirm the new prompt persists
- [ ] Log out — confirm login page shows, catalog not accessible
- [ ] Share the URL + credentials with the rest of the FE team via Slack DM

---

## Spec Coverage Check

| Spec requirement | Covered by |
|------------------|-----------|
| Vite + React + TypeScript | Task 1 |
| Supabase email/password, single shared account | Tasks 2, 5, 7 |
| Email confirmations disabled | Task 2 Step 3 |
| Full login gate — unauthenticated sees only LoginPage | Task 7 |
| Session persists in localStorage across browser sessions | Handled by Supabase JS SDK (automatic) |
| Logout button in header | Task 6 (App.tsx header) |
| `prompts` table with correct schema | Task 2 Step 2 |
| `set_updated_at` trigger | Task 2 Step 2 |
| RLS — authenticated full access, anon no access | Task 2 Step 2 |
| Seed data for 2 original prompts | Tasks 4 |
| Remove `DEFAULT_PROMPTS` | Task 6 |
| Remove `PasswordModal`, `isAdmin`, `showPasswordModal` | Task 6 |
| Replace `window.storage` with Supabase | Task 6 |
| `copy-count` stays in localStorage | Task 6 |
| Export/Import available to all logged-in users | Task 6 |
| GitHub Pages hosting | Tasks 9–13 |
| GitHub Actions CI/CD | Tasks 10–13 |
| `.env.local` gitignored | Task 3 |
