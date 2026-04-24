# FE Team Prompt Catalog

A shared prompt library for the FE team. Prompts are stored in Supabase and accessible to all team members via a login-gated web app.

**Live app:** https://anett-ds.github.io/prompt-catalog/

## Features

- Browse, create, edit and delete prompts
- Fill in template placeholders and copy the generated prompt
- Import / export prompts as JSON
- Changes are shared in real time across the team (Supabase backend)

## Local development

1. Copy `.env.local.example` to `.env.local` and fill in the Supabase credentials (ask in Slack)
2. Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173/prompt-catalog/`.

## Deployment

Pushing to `main` automatically builds and deploys to GitHub Pages via GitHub Actions.

## Tech stack

- Vite + React + TypeScript
- Supabase (Postgres + Auth)
- GitHub Actions + GitHub Pages
