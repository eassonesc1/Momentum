# Momentum AI Development Guide

Momentum is a personal productivity and life tracking web application.

The goal is to build a calm, premium, minimalist experience.

## General Principles

- Never remove existing features unless explicitly requested.
- Prefer minimal, targeted changes over large rewrites.
- Preserve the existing project architecture.
- Reuse existing components whenever possible.
- Avoid unnecessary dependencies.
- Keep code clean, readable, and maintainable.

## UI / UX

Always preserve Momentum's design language.

- Minimal
- Calm
- Premium
- Consistent
- Clean

Rules:

- Avoid visual clutter.
- Keep spacing and alignment consistent.
- Keep typography consistent.
- Avoid unnecessary buttons.
- Keep cards aligned.
- Prevent horizontal overflow.
- Desktop and mobile layouts should both work correctly.
- Empty values should display placeholders, such as `-` or `--:--`, instead of fake or calculated data.
- Do not introduce placeholder analytics unless explicitly requested.

## Code Quality

- Prefer reusable components.
- Remove dead code when appropriate.
- Avoid duplicated logic.
- Keep files organized.
- Follow existing naming conventions.

## Before Completing Any Task

Always perform the following steps automatically:

1. Run:

   ```bash
   npm run build
   ```

2. If the build fails, fix all errors before continuing.
3. Stage all modified files:

   ```bash
   git add .
   ```

4. Create a Git commit.

Commit messages must:

- Be written in English.
- Be concise.
- Accurately describe the primary change.

Examples:

- Improve dashboard layout
- Fix profile loading
- Update analytics charts

## Git Rules

Never run:

```bash
git push
```

Leave the repository ready for manual review and manual push.

## Final Response

Always include:

- Summary of completed changes
- Git commit message used
- Build status
- Remaining issues or follow-up work, if any

