# Prompt Catalog — Design Spec

**Date:** 2026-04-24
**Status:** Approved

---

## Context

The prompt catalog is a Claude Artifact (single TSX file) that lets a frontend team store and copy reusable AI prompt templates. It currently runs only as an Artifact — storage is `window.storage` (Artifact-only API), and editing is gated behind a hardcoded admin password. The goal is to convert it into a shareable Vite+React app with real persistent storage, proper authentication, and free hosting — so the team can all read and manage the same shared library.

---

## Architecture

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Vite + React + TypeScript | Direct conversion from the Artifact TSX |
| Database | Supabase (free tier, PostgreSQL) | Apache 2.0 license, client-side accessible via anon key + RLS, generous free tier |
| Auth | Supabase email/password (single shared account) | Simplest setup for a 3–4 person team; no OAuth app registration needed |
| Hosting | GitHub Pages | Already available; purely static build works without server |
| CI/CD | GitHub Actions | Auto-deploys on push to `main` |

---

## Authentication

- **One shared Supabase account** (email + password chosen by the owner, shared with team via Slack/DM)
- The "email" doesn't need to be a real address — since email confirmation is disabled, any valid email format works (e.g. `fe_team@team.local`). This acts as a username and avoids sharing a personal email.
- Email confirmation is **disabled** in Supabase auth settings
- **Full login gate**: unauthenticated users see only `<LoginPage>` — nothing of the catalog is rendered or accessible
- On successful login, the Supabase JS SDK stores the session in `localStorage`; the user stays logged in across browser sessions until they log out
- The catalog header shows a `🔓 Logout` button; no "Admin" toggle

---

## Data Model

### `prompts` table

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

-- Auto-update updated_at on every row update
create or replace function set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger prompts_updated_at
  before update on prompts
  for each row execute function set_updated_at();
```

No `builtin` column — all prompts (including the two originals) are stored in the database and are fully editable.

### Row Level Security

```sql
alter table prompts enable row level security;

-- Authenticated users get full access
create policy "auth_full_access" on prompts
  for all to authenticated
  using (true)
  with check (true);

-- Anonymous users: no access
```

### Seed data (paste into Supabase SQL editor after setup)

The two original built-in prompts (Replace PrimeReact, Code Refactoring) are provided as an INSERT statement in `supabase/seed.sql`. The owner inserts them manually once after creating the database.

---

## Storage Migration

| Before (Artifact) | After (Supabase) |
|-------------------|-----------------|
| `window.storage.get("custom-prompts")` | `supabase.from("prompts").select("*")` |
| `window.storage.set("custom-prompts", json)` | `supabase.from("prompts").insert(...)` / `.update(...)` |
| `window.storage.delete(...)` | `supabase.from("prompts").delete().eq("id", id)` |
| `window.storage.get("copy-count")` | `localStorage` (copy count is personal, not shared) |

---

## What Changes in the TSX

1. **Remove** `DEFAULT_PROMPTS` constant — all prompts come from Supabase
2. **Remove** `PasswordModal`, `ADMIN_PASSWORD`, `isAdmin`, `showPasswordModal` state
3. **Add** Supabase session state; render `<LoginPage>` when `session === null`
4. **Replace** all `window.storage` calls with Supabase client calls
5. **Add** loading states for async Supabase fetches
6. **Keep** `localStorage` for `copy-count` (milestone counter stays personal)
7. **Keep** Export/Import functionality (now available to all logged-in users)

---

## File Structure

```
prompt-catalog/
├── src/
│   ├── App.tsx            # Main catalog component (adapted from artifact)
│   ├── LoginPage.tsx      # Full-page login form
│   ├── supabase.ts        # Supabase client singleton
│   └── main.tsx           # Entry point with session gate
├── supabase/
│   └── seed.sql           # INSERT for the two original built-in prompts
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── .env.local             # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (gitignored)
└── .github/
    └── workflows/
        └── deploy.yml     # Build + deploy to gh-pages branch
```

---

## Implementation Phases

### Phase 1 — Local development (done first, verified before any deployment work)

1. Scaffold Vite + React + TypeScript project
2. Copy `prompt-catalog.tsx` into `src/App.tsx`
3. Install `@supabase/supabase-js`
4. Create `src/supabase.ts` with Supabase client using `import.meta.env` vars
5. Add `.env.local` with Supabase credentials (gitignored)
6. Create `src/LoginPage.tsx` — email/password form calling `supabase.auth.signInWithPassword`
7. Modify `src/main.tsx` to check session and gate render
8. Adapt `App.tsx`: remove `window.storage`, remove admin auth, wire Supabase CRUD
9. Create `supabase/seed.sql` with the two original prompts
10. Run locally with `npm run dev`, verify all CRUD operations work

### Phase 2 — GitHub Pages deployment

11. Create GitHub repo, push code
12. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as GitHub Actions secrets
13. Add `.github/workflows/deploy.yml`
14. Enable GitHub Pages from `gh-pages` branch in repo settings
15. Push to `main`, verify deployment

---

## One-Time Supabase Setup (owner does this manually)

1. Create free project at supabase.com
2. Run the `CREATE TABLE` + `RLS` SQL from this spec in the SQL editor
3. Run `seed.sql` to insert the original two prompts
4. In Auth → Settings: disable "Enable email confirmations"
5. In Auth → Users: create the shared account (email + password)
6. Copy Project URL and anon key into `.env.local` and GitHub secrets

---

## Verification

- `npm run dev` → app loads, shows login page
- Enter credentials → catalog loads with prompts from Supabase
- Add a new prompt → appears immediately, persists after page refresh
- Edit a prompt → changes visible to all team members
- Delete a prompt → removed from all sessions
- Logout → login page shown, catalog not accessible
- `npm run build` → no TypeScript errors, `dist/` produced
- After deployment: GitHub Pages URL shows login page, full flow works
