# Momentum Project Protection

Momentum is an independent project. Treat this repository, its configuration, and its deployment settings as separate from every other project.

## Rules

- Never copy source files, build output, cache folders, or configuration from another project into this repository.
- Never share or copy `.git` folders between projects.
- Never reuse another project's Vercel configuration.
- Never reuse another project's environment variables.
- Never change the Git remote automatically.
- Before changing files, verify the project folder, package name, and Git remote belong to Momentum.

## Expected Identity

- Project folder: `momentum`
- Package name: `momentum`
- Git remote: `https://github.com/eassonesc1/Momentum.git`
- Build output: `dist`
- Framework: Vite

## Safety Check

Run this before development or deployment:

```bash
npm run check:identity
```

The same check runs automatically before `npm run dev`, `npm run build`, and `npm run preview`.
