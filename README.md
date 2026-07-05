# Momentum

Momentum is a personal operating system for daily workspace capture, journaling, job applications, and reflective insights.

## Local Setup

```bash
npm install
npm run dev
```

The app runs at:

```text
http://localhost:5173
```

## Supabase Setup

Create a Supabase project, then add these variables to `.env`:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run the schema in Supabase SQL Editor:

```sql
-- paste the contents of supabase/schema.sql
```

Tables used by the MVP:

- `profiles`
- `daily_entries`
- `journal_entries`
- `job_applications`

This MVP uses a simple User ID system. It does not use email/password authentication yet.

## LocalStorage Fallback

If Supabase environment variables are missing, Momentum keeps working and saves data to browser `localStorage`.

## Build

```bash
npm run build
```

## Prototype Security Note

The MVP schema disables RLS for speed of prototyping. Before sharing sensitive data or production use, add proper authentication and row-level security policies.
